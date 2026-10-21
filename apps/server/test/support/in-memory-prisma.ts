/**
 * PrismaService giả lập trong RAM cho test e2e (Jest + supertest).
 *
 * Vì sao không dùng PostgreSQL thật: job CI chỉ có DATABASE_URL giả, không có service Postgres.
 * Bộ giả lập này chỉ cài ĐÚNG các truy vấn mà AuthService / AuthJwtGuard / RoomService đang dùng,
 * với ngữ nghĩa giống Prisma (unique constraint → lỗi P2002, select lồng quan hệ, updateMany trả count).
 * Thêm truy vấn mới vào service thì phải bổ sung ở đây, nếu không test sẽ báo "not implemented".
 */
import { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type Select = Record<string, unknown>;

interface Relation {
  table: string;
  /** Khóa ngoại nằm ở bảng hiện tại (belongs-to) hay ở bảng kia (has-many). */
  kind: 'one' | 'many';
  localKey: string;
  foreignKey: string;
}

interface TableDef {
  unique: string[][];
  defaults: () => Row;
  relations: Record<string, Relation>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Date) &&
    typeof value !== 'bigint' &&
    !Array.isArray(value)
  );
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function uniqueViolation(table: string, fields: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the fields: (${fields.join(',')}) in ${table}`,
    { code: 'P2002', clientVersion: 'in-memory', meta: { target: fields } },
  );
}

export class InMemoryPrisma {
  private readonly tables = new Map<string, Row[]>();
  private readonly sequences = new Map<string, bigint>();
  private readonly defs: Record<string, TableDef>;

  readonly user: ModelDelegate;
  readonly authSession: ModelDelegate;
  readonly room: ModelDelegate;
  readonly roomMember: ModelDelegate;
  readonly ruleProfile: ModelDelegate;

  constructor() {
    const now = (): Date => new Date();
    this.defs = {
      user: {
        unique: [['username'], ['email']],
        defaults: () => ({
          avatarUrl: null,
          bio: null,
          role: 'PLAYER',
          accountStatus: 'ACTIVE',
          rating: 1200,
          createdAt: now(),
          lastLoginAt: null,
        }),
        relations: {},
      },
      authSession: {
        unique: [['refreshTokenHash']],
        defaults: () => ({ revokedAt: null, lastUsedAt: null, createdAt: now() }),
        relations: {
          user: { table: 'user', kind: 'one', localKey: 'userId', foreignKey: 'id' },
        },
      },
      ruleProfile: {
        unique: [['code']],
        defaults: () => ({ isRanked: false }),
        relations: {},
      },
      room: {
        unique: [['roomCode']],
        defaults: () => ({
          visibility: 'PUBLIC',
          hostColorPref: 'RANDOM',
          status: 'WAITING',
          createdAt: now(),
          updatedAt: now(),
        }),
        relations: {
          host: { table: 'user', kind: 'one', localKey: 'hostId', foreignKey: 'id' },
          ruleProfile: { table: 'ruleProfile', kind: 'one', localKey: 'ruleProfileId', foreignKey: 'id' },
          members: { table: 'roomMember', kind: 'many', localKey: 'id', foreignKey: 'roomId' },
        },
      },
      roomMember: {
        unique: [['roomId', 'userId']],
        defaults: () => ({ isReady: false, joinedAt: now() }),
        relations: {
          user: { table: 'user', kind: 'one', localKey: 'userId', foreignKey: 'id' },
          room: { table: 'room', kind: 'one', localKey: 'roomId', foreignKey: 'id' },
        },
      },
    };
    for (const name of Object.keys(this.defs)) {
      this.tables.set(name, []);
      this.sequences.set(name, 0n);
    }
    this.user = new ModelDelegate(this, 'user');
    this.authSession = new ModelDelegate(this, 'authSession');
    this.room = new ModelDelegate(this, 'room');
    this.roomMember = new ModelDelegate(this, 'roomMember');
    // ruleProfile.id là Int (SERIAL) chứ không phải BigInt
    this.ruleProfile = new ModelDelegate(this, 'ruleProfile', 'number');
  }

  /** Giao dịch tuần tự: đủ cho test vì Node chạy một luồng và test không chạy song song trong một app. */
  async $transaction<T>(fn: (tx: InMemoryPrisma) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
  async onModuleInit(): Promise<void> {}
  async onModuleDestroy(): Promise<void> {}

  /** Truy cập thẳng dữ liệu để test sắp xếp tình huống (ví dụ: khóa tài khoản, làm hết hạn phiên). */
  rows(table: string): Row[] {
    const rows = this.tables.get(table);
    if (!rows) throw new Error(`Unknown table ${table}`);
    return rows;
  }

  def(table: string): TableDef {
    return this.defs[table];
  }

  nextId(table: string, idType: 'bigint' | 'number'): bigint | number {
    const next = (this.sequences.get(table) ?? 0n) + 1n;
    this.sequences.set(table, next);
    return idType === 'number' ? Number(next) : next;
  }

  matches(table: string, row: Row, where: Where | undefined): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') {
        return (condition as Where[]).some((sub) => this.matches(table, row, sub));
      }
      if (key === 'AND') {
        return (condition as Where[]).every((sub) => this.matches(table, row, sub));
      }
      if (key === 'NOT') {
        return !this.matches(table, row, condition as Where);
      }
      const relation = this.defs[table].relations[key];
      if (relation) {
        return this.matchesRelation(row, relation, condition as Where);
      }
      // Khóa unique kép kiểu Prisma: where: { roomId_userId: { roomId, userId } }
      if (key.includes('_') && isPlainObject(condition) && !(key in row)) {
        return Object.entries(condition).every(([k, v]) => sameValue(row[k], v));
      }
      const value = row[key];
      if (isPlainObject(condition)) {
        return Object.entries(condition).every(([op, operand]) => {
          switch (op) {
            case 'equals':
              return sameValue(value, operand);
            case 'not':
              return !sameValue(value, operand);
            case 'in':
              return (operand as unknown[]).some((o) => sameValue(value, o));
            case 'notIn':
              return !(operand as unknown[]).some((o) => sameValue(value, o));
            case 'lt':
              return (value as number | Date) < (operand as number | Date);
            case 'lte':
              return (value as number | Date) <= (operand as number | Date);
            case 'gt':
              return (value as number | Date) > (operand as number | Date);
            case 'gte':
              return (value as number | Date) >= (operand as number | Date);
            default:
              throw new Error(`InMemoryPrisma: operator "${op}" not implemented`);
          }
        });
      }
      return sameValue(value, condition);
    });
  }

  private matchesRelation(row: Row, relation: Relation, condition: Where): boolean {
    const related = this.rows(relation.table).filter((r) =>
      sameValue(r[relation.foreignKey], row[relation.localKey]),
    );
    if (relation.kind === 'one') {
      return related.length > 0 && this.matches(relation.table, related[0], condition);
    }
    const [[op, sub]] = Object.entries(condition) as [string, Where][];
    if (op === 'some') return related.some((r) => this.matches(relation.table, r, sub));
    if (op === 'none') return !related.some((r) => this.matches(relation.table, r, sub));
    if (op === 'every') return related.every((r) => this.matches(relation.table, r, sub));
    throw new Error(`InMemoryPrisma: relation filter "${op}" not implemented`);
  }

  project(table: string, row: Row, select?: Select, include?: Select): Row {
    const base: Row = {};
    if (select) {
      for (const [field, spec] of Object.entries(select)) {
        if (!spec) continue;
        const relation = this.defs[table].relations[field];
        if (relation) {
          base[field] = this.resolveRelation(row, relation, spec === true ? undefined : (spec as Select));
        } else {
          base[field] = row[field];
        }
      }
      return base;
    }
    Object.assign(base, row);
    for (const [field, spec] of Object.entries(include ?? {})) {
      if (!spec) continue;
      const relation = this.defs[table].relations[field];
      base[field] = this.resolveRelation(row, relation, spec === true ? undefined : (spec as Select));
    }
    return base;
  }

  private resolveRelation(row: Row, relation: Relation, args?: Select): unknown {
    const nestedSelect = args?.select as Select | undefined;
    const nestedInclude = args?.include as Select | undefined;
    // Cho phép viết select lồng kiểu { user: { select: {...} } } hoặc { user: { id: true } }
    const fieldSelect =
      nestedSelect ?? (args && !('select' in args) && !('include' in args) && !('where' in args) && !('orderBy' in args) ? args : undefined);
    const related = this.rows(relation.table).filter((r) =>
      sameValue(r[relation.foreignKey], row[relation.localKey]),
    );
    if (relation.kind === 'one') {
      return related[0] ? this.project(relation.table, related[0], fieldSelect, nestedInclude) : null;
    }
    let list = related.filter((r) => this.matches(relation.table, r, args?.where as Where | undefined));
    list = sortRows(list, args?.orderBy);
    return list.map((r) => this.project(relation.table, r, fieldSelect, nestedInclude));
  }
}

function sortRows(rows: Row[], orderBy: unknown): Row[] {
  if (!orderBy) return rows;
  const orders = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Record<string, 'asc' | 'desc'>[];
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [[field, dir]] = Object.entries(order);
      const av = a[field] as number | bigint | Date | string;
      const bv = b[field] as number | bigint | Date | string;
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

interface FindArgs {
  where?: Where;
  select?: Select;
  include?: Select;
  orderBy?: unknown;
  take?: number;
  skip?: number;
}

interface WriteArgs {
  where?: Where;
  data: Row;
  select?: Select;
  include?: Select;
}

class ModelDelegate {
  constructor(
    private readonly db: InMemoryPrisma,
    private readonly table: string,
    private readonly idType: 'bigint' | 'number' = 'bigint',
  ) {}

  private get rows(): Row[] {
    return this.db.rows(this.table);
  }

  async findUnique(args: FindArgs): Promise<Row | null> {
    return this.findFirst(args);
  }

  async findUniqueOrThrow(args: FindArgs): Promise<Row> {
    const row = await this.findFirst(args);
    if (!row) {
      throw new Prisma.PrismaClientKnownRequestError('No record found', {
        code: 'P2025',
        clientVersion: 'in-memory',
      });
    }
    return row;
  }

  async findFirst(args: FindArgs = {}): Promise<Row | null> {
    const [first] = await this.findMany({ ...args, take: 1 });
    return first ?? null;
  }

  async findMany(args: FindArgs = {}): Promise<Row[]> {
    let list = this.rows.filter((row) => this.db.matches(this.table, row, args.where));
    list = sortRows(list, args.orderBy);
    if (args.skip) list = list.slice(args.skip);
    if (args.take !== undefined) list = list.slice(0, args.take);
    return list.map((row) => this.db.project(this.table, row, args.select, args.include));
  }

  async count(args: { where?: Where } = {}): Promise<number> {
    return this.rows.filter((row) => this.db.matches(this.table, row, args.where)).length;
  }

  async create(args: WriteArgs): Promise<Row> {
    const row: Row = { ...this.db.def(this.table).defaults(), ...this.plainData(args.data) };
    if (row.id === undefined) {
      row.id = this.db.nextId(this.table, this.idType);
    }
    this.assertUnique(row);
    this.rows.push(row);
    return this.db.project(this.table, row, args.select, args.include);
  }

  async update(args: WriteArgs): Promise<Row> {
    const row = this.rows.find((r) => this.db.matches(this.table, r, args.where));
    if (!row) {
      throw new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025',
        clientVersion: 'in-memory',
      });
    }
    const next = { ...row, ...this.plainData(args.data) };
    if (this.db.def(this.table).defaults().updatedAt !== undefined && args.data.updatedAt === undefined) {
      next.updatedAt = new Date();
    }
    this.assertUnique(next, row);
    Object.assign(row, next);
    return this.db.project(this.table, row, args.select, args.include);
  }

  async updateMany(args: WriteArgs): Promise<{ count: number }> {
    const targets = this.rows.filter((r) => this.db.matches(this.table, r, args.where));
    for (const row of targets) {
      const next = { ...row, ...this.plainData(args.data) };
      this.assertUnique(next, row);
      Object.assign(row, next);
    }
    return { count: targets.length };
  }

  async delete(args: { where: Where }): Promise<Row> {
    const index = this.rows.findIndex((r) => this.db.matches(this.table, r, args.where));
    if (index < 0) {
      throw new Prisma.PrismaClientKnownRequestError('Record to delete does not exist', {
        code: 'P2025',
        clientVersion: 'in-memory',
      });
    }
    const [removed] = this.rows.splice(index, 1);
    return removed;
  }

  async deleteMany(args: { where?: Where } = {}): Promise<{ count: number }> {
    const keep = this.rows.filter((r) => !this.db.matches(this.table, r, args.where));
    const count = this.rows.length - keep.length;
    this.rows.splice(0, this.rows.length, ...keep);
    return { count };
  }

  private plainData(data: Row): Row {
    const out: Row = {};
    for (const [key, value] of Object.entries(data)) {
      if (isPlainObject(value)) {
        throw new Error(
          `InMemoryPrisma: nested write "${this.table}.${key}" not implemented; dùng khóa ngoại trực tiếp`,
        );
      }
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  private assertUnique(candidate: Row, self?: Row): void {
    for (const fields of this.db.def(this.table).unique) {
      const clash = this.rows.some(
        (r) => r !== self && fields.every((f) => sameValue(r[f], candidate[f])),
      );
      if (clash) throw uniqueViolation(this.table, fields);
    }
  }
}
