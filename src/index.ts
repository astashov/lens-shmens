import { ObjectUtils } from "./utils/object";
import { IArrayElement } from "./utils/types";

type IGetter<T, R> = (obj: T) => R;
type ISetter<T, R> = (obj: T, value: R) => T;

export class LensError<T, R> extends Error {
  constructor(
    m: string,
    public readonly lens: Lens<T, R>,
    public readonly type: "get" | "set",
    public readonly err: Error,
    public readonly value?: R
  ) {
    super(m);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, LensError.prototype);
  }
}

export type ILensRecording<T> = {
  (obj: T): T;
  toString(): string;
};

export type ILensRecordingPayload<T> = {
  fn: ILensRecording<T>;
  str: string;
  lens: Lens<any, any>;
  lensGetters?: Record<string, Lens<any, any>>;
  type: "set" | "modify";
  value: { v: any };
  log: (startName: string) => void;
  prepend: <R, O2 = never>(lens: Lens<R, T> | LensBuilder<R, T, {}, O2>) => ILensRecordingPayload<R>;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
type ValueFromLens<T> = T extends Lens<infer A, infer B> ? B : never;

// eslint-disable-next-line @typescript-eslint/naming-convention
type ValuesFromLens<T> = T extends { [P in keyof T]: Lens<any, any> } ? { [P in keyof T]: ValueFromLens<T[P]> } : never;

export type ILensGetters<T> = { [P in string]: Lens<T, any> };

export interface IPartialBuilder<T, U extends ILensGetters<T>> {
  p: <R extends keyof T>(key: R) => LensBuilder<T, T[R], U>;
  pi: {
    <R extends keyof T>(key: R, fallback: Exclude<T[R], undefined>): LensBuilder<T, Exclude<T[R], undefined>, U>;
    <R extends keyof T>(key: R): LensBuilder<T, Exclude<T[R], undefined>, U, undefined>;
  };
  i: (index: number) => LensBuilder<T, T extends unknown[] ? T[number] : never, U>;
  find: <A extends T extends unknown[] ? IArrayElement<T> : never>(
    cb: (el: A) => boolean
  ) => LensBuilder<T, T extends unknown[] ? T[number] : never, U>;
  findBy: <A extends T extends unknown[] ? IArrayElement<T> : never, B extends keyof A>(
    key: B,
    value: A[B],
    isReverse?: boolean
  ) => LensBuilder<T, T extends unknown[] ? T[number] : never, U>;
  get: () => Lens<T, T>;
  record: (value: T, name?: string) => ILensRecordingPayload<T>;
  recordModify: (fn: (v: T) => T, name?: string) => ILensRecordingPayload<T>;
}

interface IPartialBuilderWithObject<T> {
  p: <R extends keyof T>(key: R) => LensBuilderWithObject<T, T[R]>;
  pi: {
    <R extends keyof T>(key: R, fallback: Exclude<T[R], undefined>): LensBuilderWithObject<T, Exclude<T[R], undefined>>;
    <R extends keyof T>(key: R): LensBuilderWithObject<T, Exclude<T[R], undefined>, undefined>;
  };
  i: (index: number) => LensBuilderWithObject<T, T extends unknown[] ? T[number] : never>;
  find: <A extends T extends unknown[] ? IArrayElement<T> : never>(
    cb: (el: A) => boolean
  ) => LensBuilderWithObject<T, T extends unknown[] ? T[number] : never>;
  findBy: <A extends T extends unknown[] ? IArrayElement<T> : never, B extends keyof A>(
    key: B,
    value: A[B],
    isReverse?: boolean
  ) => LensBuilderWithObject<T, T extends unknown[] ? T[number] : never>;
  get: () => Lens<T, T>;
  record: (value: T, name?: string) => ILensRecordingPayload<T>;
  recordModify: (fn: (v: T) => T, name?: string) => ILensRecordingPayload<T>;
}

abstract class AbstractLensBuilder<T, R, O = never> {
  constructor(protected readonly lens: Lens<T, R>) {}

  public get(): Lens<T, R | O> {
    return this.lens as any;
  }
}

export class LensBuilderWithObject<T, R, O = never> extends AbstractLensBuilder<T, R, O> {
  constructor(lens: Lens<T, R>, private readonly obj: T) {
    super(lens);
  }

  public static start<T>(
    lensFactory: <R extends keyof T>(key: R) => Lens<T, T[R]>,
    obj: T
  ): IPartialBuilderWithObject<T> {
    return {
      p: <R extends keyof T>(key: R): LensBuilderWithObject<T, T[R]> => {
        return new LensBuilderWithObject<T, T[R]>(lensFactory(key), obj);
      },
      pi: (<R extends keyof T>(key: R, fallback?: Exclude<T[R], undefined>) => {
        const baseLens = lensFactory(key);
        if (fallback !== undefined) {
          const lens = new Lens<T, Exclude<T[R], undefined>>(
            (s) => (baseLens.get(s) ?? fallback) as any,
            baseLens.set as any,
            { from: baseLens.from, to: baseLens.to }
          );
          return new LensBuilderWithObject<T, Exclude<T[R], undefined>>(lens, obj);
        }
        baseLens._optional = true;
        return new LensBuilderWithObject<T, Exclude<T[R], undefined>, undefined>(baseLens as any, obj);
      }) as IPartialBuilderWithObject<T>["pi"],
      i: (index: number): LensBuilderWithObject<T, T extends unknown[] ? T[number] : never> => {
        // @ts-ignore
        return new LensBuilderWithObject<T, T[number]>(lensFactory(index), obj);
      },
      find: <A extends T extends unknown[] ? IArrayElement<T> : never>(
        cb: (el: A) => boolean
      ): LensBuilderWithObject<T, T extends unknown[] ? T[number] : never> => {
        // @ts-ignore
        return new LensBuilderWithObject<T, T[number], U>(lensFactory(cb), obj);
      },
      findBy: <A extends T extends unknown[] ? IArrayElement<T> : never, B extends keyof A>(
        key: B,
        value: A[B],
        isReverse?: boolean
      ): LensBuilderWithObject<T, T extends unknown[] ? T[number] : never> => {
        // @ts-ignore
        return new LensBuilderWithObject<T, T[number], U>(lensFactory(key, value, isReverse), obj);
      },
      get: (): Lens<T, T> => {
        return new Lens(
          (s) => s,
          (s, v) => v,
          { from: "obj", to: "obj" }
        );
      },
      record: (value: T, name?: string): ILensRecordingPayload<T> => {
        return Lens.buildLensRecording(
          new Lens<T, T>(
            (s) => s,
            (s, v) => v,
            { from: "obj", to: "obj" }
          ),
          value,
          name
        );
      },
      recordModify: (fn: (v: T) => T, name?: string): ILensRecordingPayload<T> => {
        return Lens.buildLensModifyRecording(
          new Lens<T, T>(
            (s) => s,
            (s, v) => v,
            { from: "obj", to: "obj" }
          ),
          fn,
          {},
          name
        );
      },
    };
  }

  public p<K extends keyof R>(key: K): LensBuilderWithObject<T, R[K], O> {
    return new LensBuilderWithObject<T, R[K], O>(this.lens.then(Lens.prop<R>()(key)), this.obj);
  }

  public pi<K extends keyof R>(key: K, fallback: Exclude<R[K], undefined>): LensBuilderWithObject<T, Exclude<R[K], undefined>, O>;
  public pi<K extends keyof R>(key: K): LensBuilderWithObject<T, Exclude<R[K], undefined>, O | undefined>;
  public pi<K extends keyof R>(key: K, fallback?: Exclude<R[K], undefined>): any {
    const propLens = Lens.prop<R>()(key);
    if (fallback !== undefined) {
      const lens = new Lens<R, Exclude<R[K], undefined>>(
        (s) => (propLens.get(s) ?? fallback) as any,
        propLens.set as any,
        { from: propLens.from, to: propLens.to }
      );
      return new LensBuilderWithObject<T, Exclude<R[K], undefined>, O>(this.lens.then(lens), this.obj) as any;
    }
    propLens._optional = true;
    return new LensBuilderWithObject<T, Exclude<R[K], undefined>, O | undefined>(this.lens.then(propLens as any), this.obj);
  }

  public i(index: number): LensBuilderWithObject<T, R extends unknown[] ? R[number] : never, O> {
    // @ts-ignore
    return new LensBuilderWithObject<T, R[number], O>(this.lens.then(Lens.index<R>()(index)), this.obj);
  }

  public find<A extends R extends unknown[] ? IArrayElement<R> : never>(
    cb: (el: A) => boolean
  ): LensBuilderWithObject<T, R extends unknown[] ? R[number] : never, O> {
    // @ts-ignore
    return new LensBuilderWithObject<T, R[number], O>(this.lens.then(Lens.find<R>()(cb)), this.obj);
  }

  public findBy<A extends R extends unknown[] ? IArrayElement<R> : never, B extends keyof A>(
    key: B,
    value: A[B],
    isReverse?: boolean
  ): LensBuilderWithObject<T, R extends unknown[] ? R[number] : never, O> {
    // @ts-ignore
    return new LensBuilderWithObject<T, R[number], O>(this.lens.then(Lens.findBy()(key, value, isReverse)), this.obj);
  }

  public set(value: R): T {
    return this.lens.set(this.obj, value);
  }

  public modify(fn: (value: R) => R): T {
    return this.lens.modify(this.obj, fn);
  }
}

export class LensBuilder<T, R, U extends ILensGetters<T>, O = never> extends AbstractLensBuilder<T, R, O> {
  constructor(lens: Lens<T, R>, protected readonly lensGetters: U) {
    super(lens);
  }

  public static start<T, U extends ILensGetters<T>>(
    lensFactory: <R extends keyof T>(key: R) => Lens<T, T[R]>,
    lensGetters: U
  ): IPartialBuilder<T, U> {
    return {
      p: <R extends keyof T>(key: R): LensBuilder<T, T[R], U> => {
        return new LensBuilder<T, T[R], U>(lensFactory(key), lensGetters);
      },
      pi: (<R extends keyof T>(key: R, fallback?: Exclude<T[R], undefined>) => {
        const baseLens = lensFactory(key);
        if (fallback !== undefined) {
          const lens = new Lens<T, Exclude<T[R], undefined>>(
            (s) => (baseLens.get(s) ?? fallback) as any,
            baseLens.set as any,
            { from: baseLens.from, to: baseLens.to }
          );
          return new LensBuilder<T, Exclude<T[R], undefined>, U>(lens, lensGetters);
        }
        baseLens._optional = true;
        return new LensBuilder<T, Exclude<T[R], undefined>, U, undefined>(baseLens as any, lensGetters);
      }) as IPartialBuilder<T, U>["pi"],
      i: (index: number): LensBuilder<T, T extends unknown[] ? T[number] : never, U> => {
        // @ts-ignore
        return new LensBuilder<T, T[number]>(lensFactory(index), lensGetters);
      },
      find: <A extends T extends unknown[] ? IArrayElement<T> : never>(
        cb: (el: A) => boolean
      ): LensBuilder<T, T extends unknown[] ? T[number] : never, U> => {
        // @ts-ignore
        return new LensBuilder<T, T[number], U>(lensFactory(cb), this.lensGetters);
      },
      findBy: <A extends T extends unknown[] ? IArrayElement<T> : never, B extends keyof A>(
        key: B,
        value: A[B],
        isReverse?: boolean
      ): LensBuilder<T, T extends unknown[] ? T[number] : never, U> => {
        // @ts-ignore
        return new LensBuilder<T, T[number], U>(lensFactory(key, value, isReverse), this.lensGetters);
      },
      get: (): Lens<T, T> => {
        return new Lens(
          (s) => s,
          (s, v) => v,
          { from: "obj", to: "obj" }
        );
      },
      record: (value: T, name?: string): ILensRecordingPayload<T> => {
        return Lens.buildLensRecording(
          new Lens<T, T>(
            (s) => s,
            (s, v) => v,
            { from: "obj", to: "obj" }
          ),
          value,
          name
        );
      },
      recordModify: (fn: (v: T) => T, name?: string): ILensRecordingPayload<T> => {
        return Lens.buildLensModifyRecording(
          new Lens<T, T>(
            (s) => s,
            (s, v) => v,
            { from: "obj", to: "obj" }
          ),
          fn,
          {},
          name
        );
      },
    };
  }

  public p<K extends keyof R>(key: K): LensBuilder<T, R[K], U, O> {
    return new LensBuilder<T, R[K], U, O>(this.lens.then(Lens.prop<R>()(key)), this.lensGetters);
  }

  public i(index: number): LensBuilder<T, R extends unknown[] ? R[number] : never, U, O> {
    // @ts-ignore
    return new LensBuilder<T, R[number], U, O>(this.lens.then(Lens.index<R>()(index)), this.lensGetters);
  }

  public pi<K extends keyof R>(key: K, fallback: Exclude<R[K], undefined>): LensBuilder<T, Exclude<R[K], undefined>, U, O>;
  public pi<K extends keyof R>(key: K): LensBuilder<T, Exclude<R[K], undefined>, U, O | undefined>;
  public pi<K extends keyof R>(key: K, fallback?: Exclude<R[K], undefined>): any {
    const propLens = Lens.prop<R>()(key);
    if (fallback !== undefined) {
      const lens = new Lens<R, Exclude<R[K], undefined>>(
        (s) => (propLens.get(s) ?? fallback) as any,
        propLens.set as any,
        { from: propLens.from, to: propLens.to }
      );
      return new LensBuilder<T, Exclude<R[K], undefined>, U, O>(
        this.lens.then(lens),
        this.lensGetters
      ) as any;
    }
    propLens._optional = true;
    return new LensBuilder<T, Exclude<R[K], undefined>, U, O | undefined>(
      this.lens.then(propLens as any),
      this.lensGetters
    );
  }

  public find<A extends R extends unknown[] ? IArrayElement<R> : never>(
    cb: (el: A) => boolean
  ): LensBuilder<T, R extends unknown[] ? R[number] : never, U, O> {
    // @ts-ignore
    return new LensBuilder<T, R[number], U, O>(this.lens.then(Lens.find<R>()(cb)), this.lensGetters);
  }

  public findBy<A extends R extends unknown[] ? IArrayElement<R> : never, B extends keyof A>(
    key: B,
    value: A[B],
    isReverse?: boolean
  ): LensBuilder<T, R extends unknown[] ? R[number] : never, U, O> {
    // @ts-ignore
    return new LensBuilder<T, R[number], U, O>(this.lens.then(Lens.findBy<R>()(key, value, isReverse)), this.lensGetters);
  }

  public set(obj: T, value: R): T {
    return this.lens.set(obj, value);
  }

  public modify(obj: T, fn: (value: R) => R): T {
    return this.lens.modify(obj, fn);
  }

  public record(value: R, name?: string): ILensRecordingPayload<T> {
    return Lens.buildLensRecording(this.lens, value, name);
  }

  public recordModify(fn: (v: R, getters: ValuesFromLens<U>) => R, name?: string): ILensRecordingPayload<T> {
    return Lens.buildLensModifyRecording(this.lens, fn, this.lensGetters, name);
  }
}

export function lb<T>(): IPartialBuilder<T, {}> {
  return Lens.build({});
}

export function lbu<T, U extends ILensGetters<T>>(lens: U): IPartialBuilder<T, U> {
  return Lens.build(lens);
}

export function lf<T>(obj: T): IPartialBuilderWithObject<T> {
  return Lens.from(obj);
}

export class Lens<T, R> {
  public readonly get: IGetter<T, R>;
  public readonly set: ISetter<T, R>;
  public readonly from: string[];
  public readonly to: string;
  public _optional: boolean = false;

  public static buildLensModifyRecording<T, R, U extends ILensGetters<T>, O = never>(
    aLens: Lens<T, R> | LensBuilder<T, R, U, O>,
    modifyFn: <Z extends ValuesFromLens<U>>(v: R, getters: Z) => R,
    lensGetters: U,
    name?: string
  ): ILensRecordingPayload<T> {
    const lens: Lens<T, R> = aLens instanceof Lens ? aLens : (aLens.get() as Lens<T, R>);
    const value: { v: any } = { v: undefined };
    const fn: ILensRecording<T> = (obj: T) => {
      const getters = ObjectUtils.keys(lensGetters).reduce<ValuesFromLens<U>>((memo, key) => {
        // @ts-ignore
        memo[key] = lensGetters[key].get(obj) as any;
        return memo;
      }, {} as any);
      return lens.modify(obj, (v) => {
        const newValue = modifyFn(v, getters);
        value.v = newValue;
        return newValue;
      });
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    fn.toString = (): string => {
      return `${lens.toString()} = \`modify\``;
    };
    const log = (startName: string): void => {
      for (const g of Object.keys(lensGetters)) {
        const l = lensGetters[g];
        const lensGetterStr = [startName, ...l.from.slice(1), l.to].join(" -> ");
        console.log("getter: ", lensGetterStr);
      }
      if (name != null) {
        console.log(`${name}: `);
      }
      console.log([startName, ...lens.from.slice(1), lens.to].join(" -> "), "=", "`modify`");
    };
    return {
      fn,
      str: fn.toString(),
      lens,
      lensGetters,
      value,
      log,
      type: "modify",
      prepend: <V, W extends ILensGetters<V>, O2 = never>(
        newLensOrBuilder: Lens<V, T> | LensBuilder<V, T, W, O2>
      ): ILensRecordingPayload<V> => {
        const newLens: Lens<V, T> = newLensOrBuilder instanceof Lens ? newLensOrBuilder : (newLensOrBuilder.get() as Lens<V, T>);
        const combinedLens = newLens.then(lens);
        const newLensGetters = ObjectUtils.keys(lensGetters).reduce<W>((memo, key) => {
          const newGetter = newLens.then(lensGetters[key]);
          (memo as any)[key] = newGetter as any;
          return memo;
        }, {} as any);
        return this.buildLensModifyRecording(combinedLens, modifyFn as any, newLensGetters, name);
      },
    };
  }

  public static buildLensRecording<T, R, O = never>(
    aLens: Lens<T, R> | LensBuilder<T, R, {}, O>,
    value: R,
    name?: string
  ): ILensRecordingPayload<T> {
    const lens: Lens<T, R> = aLens instanceof Lens ? aLens : (aLens.get() as Lens<T, R>);
    const fn: ILensRecording<T> = (obj: T) => {
      return lens.set(obj, value);
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    fn.toString = (): string => {
      return `${lens.toString()} = ${value}`;
    };
    const log = (startName: string): void => {
      if (name != null) {
        console.log(`${name}: `);
      }
      console.log([startName, ...lens.from.slice(1), lens.to].join(" -> "), "=", value);
    };
    return {
      fn,
      str: fn.toString(),
      lens,
      value: { v: value },
      log,
      type: "set",
      prepend: <U, O2 = never>(newLensOrBuilder: Lens<U, T> | LensBuilder<U, T, {}, O2>): ILensRecordingPayload<U> => {
        const newLens: Lens<U, T> = newLensOrBuilder instanceof Lens ? newLensOrBuilder : (newLensOrBuilder.get() as Lens<U, T>);
        const combinedLens = newLens.then(lens);
        return this.buildLensRecording(combinedLens, value, name);
      },
    };
  }

  public static build<T, U extends ILensGetters<T>>(lens: U): IPartialBuilder<T, U> {
    return LensBuilder.start(Lens.prop(), lens);
  }

  public static from<T>(obj: T): IPartialBuilderWithObject<T> {
    return LensBuilderWithObject.start<T>(Lens.prop(), obj);
  }

  private static propKey<T, K extends keyof T>(key: K): Lens<T, T[K]> {
    return new Lens<T, T[K]>(
      (s) => s[key],
      (s, v) => {
        if (Array.isArray(s)) {
          // @ts-ignore
          return s.map((e, i) => (i === key ? v : e)) as any;
        } else {
          return { ...s, [key]: v };
        }
      },
      { from: "obj", to: `${key}` }
    );
  }

  public static prop<T>(): <K extends keyof T>(key: K) => Lens<T, T[K]> {
    return <K extends keyof T>(key: K) => Lens.propKey(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static index<T extends any[]>(): (index: number) => Lens<T, T[number]> {
    return (index: number) => {
      return new Lens<T, T[keyof T]>(
        (a) => a[index],
        (a, v) => a.map((e, i) => (i === index ? v : e)) as T,
        { from: "obj", to: `${index}` }
      );
    };
  }

  public static find<T extends any[], A extends IArrayElement<T>>(): (cb: (el: A) => boolean) => Lens<T, T[number]> {
    return (cb: (el: A) => boolean) => {
      return new Lens<T, T[keyof T]>(
        (a) => a.filter(cb)[0],
        (a, v) => a.map((e) => (cb(e) ? v : e)) as T,
        { from: "obj", to: `find()` }
      );
    };
  }

  public static findBy<T extends any[], A extends IArrayElement<T>, B extends keyof A>(): (
    key: A,
    value: A[B],
    isReverse?: boolean
  ) => Lens<T, T[number]> {
    return (key: A, value: A[B], isReverse?: boolean) => {
      return new Lens<T, T[keyof T]>(
        (a) => {
          if (isReverse) {
            return a.filter((e) => e[key] === value).reverse()[0];
          } else {
            return a.filter((e) => e[key] === value)[0];
          }
        },
        (a, v) => {
          let index = -1;
          if (isReverse) {
            for (let i = a.length - 1; i >= 0; i--) {
              if (a[i][key] === value) {
                index = i;
                break;
              }
            }
          } else {
            for (let i = 0; i < a.length; i++) {
              if (a[i][key] === value) {
                index = i;
                break;
              }
            }
          }
          return a.map((e, i) => (i === index ? v : e)) as T;
        },
        { from: "obj", to: `${key} == ${value}` }
      );
    };
  }

  constructor(getter: IGetter<T, R>, setter: ISetter<T, R>, args: { from: string | string[]; to: string }) {
    this.get = (obj) => {
      try {
        return getter(obj);
      } catch (e) {
        const nestedErr = e instanceof LensError ? e.err : e;
        throw new LensError(
          `LensError: Error when getting ${args.from} -> ${args.to} (${nestedErr.message})`,
          this,
          "get",
          nestedErr
        );
      }
    };
    this.set = (obj, value) => {
      try {
        return setter(obj, value);
      } catch (e) {
        const nestedErr = e instanceof LensError ? e.err : e;
        throw new LensError(
          `LensError: Error when setting ${args.from} -> ${args.to} - ${value} (${nestedErr.message})`,
          this,
          "set",
          nestedErr,
          value
        );
      }
    };
    this.from = Array.isArray(args.from) ? args.from : [args.from];
    this.to = args.to;
  }

  public modify(obj: T, f: (value: R) => R): T {
    if (this._optional) {
      const current = this.get(obj);
      if (current == null) return obj;
      return this.set(obj, f(current));
    }
    return this.set(obj, f(this.get(obj)));
  }

  public then<V>(lens: Lens<R, V>): Lens<T, V> {
    const isOptional = this._optional;
    const thisGet = this.get;
    const thisSet = this.set;
    const result = new Lens<T, V>(
      (obj) => {
        const nextObj = thisGet(obj);
        if (isOptional && nextObj == null) return undefined as any;
        return lens.get(nextObj);
      },
      (obj, value) => {
        const parent = thisGet(obj);
        if (isOptional && parent == null) return obj;
        const newParent = lens.set(parent, value);
        return thisSet(obj, newParent);
      },
      {
        from: [...this.from, this.to],
        to: lens.to,
      }
    );
    if (this._optional || lens._optional) {
      result._optional = true;
    }
    return result;
  }

  public toString(): string {
    if (this.from != null && this.to != null) {
      return `${this.from.join(" -> ")} -> ${this.to}`;
    } else {
      return "Lens";
    }
  }

  public record(value: R, name?: string): ILensRecordingPayload<T> {
    return Lens.buildLensRecording(this, value, name);
  }

  public recordModify(fn: (v: R, getters: {}) => R, name?: string): ILensRecordingPayload<T> {
    return Lens.buildLensModifyRecording(this, fn, {}, name);
  }
}
