import "mocha";
import { expect } from "chai";
import { lb, lf } from "../src/index";

interface INestedChild {
  value: number;
}

interface INested {
  child?: INestedChild;
  name: string;
}

interface IState {
  a?: INested;
  b: string;
  count?: number;
}

describe("pi()", () => {
  describe("without fallback", () => {
    describe("get", () => {
      it("returns the value when it exists", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const lens = lb<IState>().pi("a").get();
        expect(lens.get(obj)).to.eql({ child: { value: 1 }, name: "hello" });
      });

      it("returns undefined when the field is undefined", () => {
        const obj: IState = { b: "world" };
        const lens = lb<IState>().pi("a").get();
        expect(lens.get(obj)).to.eql(undefined);
      });

      it("returns undefined through a chain when intermediate is undefined", () => {
        const obj: IState = { b: "world" };
        const lens = lb<IState>().pi("a").p("name").get();
        expect(lens.get(obj)).to.eql(undefined);
      });

      it("returns the deep value when the chain exists", () => {
        const obj: IState = { a: { child: { value: 42 }, name: "hello" }, b: "world" };
        const lens = lb<IState>().pi("a").p("name").get();
        expect(lens.get(obj)).to.eql("hello");
      });
    });

    describe("set", () => {
      it("sets when the field exists", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const result = lb<IState>().pi("a").p("name").set(obj, "updated");
        expect(result.a!.name).to.eql("updated");
      });

      it("is a no-op when intermediate is undefined", () => {
        const obj: IState = { b: "world" };
        const result = lb<IState>().pi("a").p("name").set(obj, "updated");
        expect(result).to.equal(obj);
      });

      it("is a no-op for deep chain when intermediate is undefined", () => {
        const obj: IState = { b: "world" };
        const result = lb<IState>().pi("a").p("child").set(obj, { value: 99 });
        expect(result).to.equal(obj);
      });
    });

    describe("modify", () => {
      it("modifies when the field exists", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const result = lb<IState>().pi("a").p("name").modify(obj, (v) => v + "!");
        expect(result.a!.name).to.eql("hello!");
      });

      it("does not call f when intermediate is undefined", () => {
        const obj: IState = { b: "world" };
        let called = false;
        const result = lb<IState>().pi("a").p("name").modify(obj, (v) => {
          called = true;
          return v + "!";
        });
        expect(result).to.equal(obj);
        expect(called).to.eql(false);
      });

      it("calls f with undefined when pi is the last step and value is undefined", () => {
        const obj: IState = { b: "world", count: undefined };
        let received: number | undefined;
        const result = lb<IState>().pi("count").modify(obj, (v) => {
          received = v as any;
          return 42;
        });
        expect(received).to.eql(undefined);
        expect(result.count).to.eql(42);
      });

      it("calls f with the value when pi is the last step and value exists", () => {
        const obj: IState = { b: "world", count: 10 };
        const result = lb<IState>().pi("count").modify(obj, (v) => v + 1);
        expect(result.count).to.eql(11);
      });
    });

    describe("record", () => {
      it("sets via recording when the field exists", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const recording = lb<IState>().pi("a").p("name").record("updated");
        const result = recording.fn(obj);
        expect(result.a!.name).to.eql("updated");
      });

      it("is a no-op via recording when intermediate is undefined", () => {
        const obj: IState = { b: "world" };
        const recording = lb<IState>().pi("a").p("name").record("updated");
        const result = recording.fn(obj);
        expect(result).to.equal(obj);
      });
    });

    describe("recordModify", () => {
      it("modifies via recording when the field exists", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const recording = lb<IState>().pi("a").p("name").recordModify((v) => v + "!");
        const result = recording.fn(obj);
        expect(result.a!.name).to.eql("hello!");
      });

      it("does not call f via recording when intermediate is undefined", () => {
        const obj: IState = { b: "world" };
        let called = false;
        const recording = lb<IState>().pi("a").p("name").recordModify((v) => {
          called = true;
          return v + "!";
        });
        const result = recording.fn(obj);
        expect(result).to.equal(obj);
        expect(called).to.eql(false);
      });
    });

    describe("chained pi()", () => {
      it("is a no-op when first pi is undefined", () => {
        const obj: IState = { b: "world" };
        const result = lb<IState>().pi("a").pi("child").p("value").set(obj, 99);
        expect(result).to.equal(obj);
      });

      it("is a no-op when second pi is undefined", () => {
        const obj: IState = { a: { name: "hello" }, b: "world" };
        const result = lb<IState>().pi("a").pi("child").p("value").set(obj, 99);
        expect(result).to.equal(obj);
      });

      it("sets when both exist", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const result = lb<IState>().pi("a").pi("child").p("value").set(obj, 99);
        expect(result.a!.child!.value).to.eql(99);
      });
    });

    describe("p() before pi()", () => {
      interface IRequiredOuter {
        a: INested;
        b: string;
      }

      it("is a no-op when pi field is undefined", () => {
        const obj: IRequiredOuter = { a: { name: "hello" }, b: "world" };
        const result = lb<IRequiredOuter>().p("a").pi("child").p("value").set(obj, 99);
        expect(result).to.equal(obj);
      });

      it("sets when pi field exists", () => {
        const obj: IRequiredOuter = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const result = lb<IRequiredOuter>().p("a").pi("child").p("value").set(obj, 99);
        expect(result.a.child!.value).to.eql(99);
      });

      it("modify does not call f when pi field is undefined", () => {
        const obj: IRequiredOuter = { a: { name: "hello" }, b: "world" };
        let called = false;
        const result = lb<IRequiredOuter>().p("a").pi("child").p("value").modify(obj, (v) => {
          called = true;
          return v + 1;
        });
        expect(result).to.equal(obj);
        expect(called).to.eql(false);
      });

      it("modify calls f when pi field exists but leaf is undefined", () => {
        interface IState2 {
          a: { b?: { c?: number } };
        }
        const obj: IState2 = { a: { b: {} } };
        let received: number | undefined;
        const result = lb<IState2>().p("a").pi("b").p("c").modify(obj, (v) => {
          received = v as any;
          return 42;
        });
        expect(received).to.eql(undefined);
        expect(result.a.b!.c).to.eql(42);
      });
    });
  });

  describe("with fallback", () => {
    const defaultNested: INested = { name: "default", child: { value: 0 } };

    describe("get", () => {
      it("returns the value when it exists", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const lens = lb<IState>().pi("a", defaultNested).get();
        expect(lens.get(obj)).to.eql({ child: { value: 1 }, name: "hello" });
      });

      it("returns the fallback when the field is undefined", () => {
        const obj: IState = { b: "world" };
        const lens = lb<IState>().pi("a", defaultNested).get();
        expect(lens.get(obj)).to.eql(defaultNested);
      });

      it("returns the deep value via fallback", () => {
        const obj: IState = { b: "world" };
        const lens = lb<IState>().pi("a", defaultNested).p("name").get();
        expect(lens.get(obj)).to.eql("default");
      });
    });

    describe("set", () => {
      it("sets through the fallback when the field is undefined", () => {
        const obj: IState = { b: "world" };
        const result = lb<IState>().pi("a", defaultNested).p("name").set(obj, "updated");
        expect(result.a!.name).to.eql("updated");
        expect(result.a!.child).to.eql({ value: 0 });
      });

      it("sets when the field already exists", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const result = lb<IState>().pi("a", defaultNested).p("name").set(obj, "updated");
        expect(result.a!.name).to.eql("updated");
        expect(result.a!.child).to.eql({ value: 1 });
      });
    });

    describe("modify", () => {
      it("modifies using fallback when the field is undefined", () => {
        const obj: IState = { b: "world" };
        const result = lb<IState>().pi("a", defaultNested).p("name").modify(obj, (v) => v + "!");
        expect(result.a!.name).to.eql("default!");
      });

      it("modifies the existing value when the field exists", () => {
        const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
        const result = lb<IState>().pi("a", defaultNested).p("name").modify(obj, (v) => v + "!");
        expect(result.a!.name).to.eql("hello!");
      });
    });

    describe("record", () => {
      it("sets via recording using fallback", () => {
        const obj: IState = { b: "world" };
        const recording = lb<IState>().pi("a", defaultNested).p("name").record("updated");
        const result = recording.fn(obj);
        expect(result.a!.name).to.eql("updated");
      });
    });

    describe("recordModify", () => {
      it("modifies via recording using fallback", () => {
        const obj: IState = { b: "world" };
        const recording = lb<IState>().pi("a", defaultNested).p("name").recordModify((v) => v + "!");
        const result = recording.fn(obj);
        expect(result.a!.name).to.eql("default!");
      });
    });
  });

  describe("lf() with pi()", () => {
    it("sets via lf when field exists", () => {
      const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
      const result = lf(obj).pi("a").p("name").set("updated");
      expect(result.a!.name).to.eql("updated");
    });

    it("is a no-op via lf when field is undefined", () => {
      const obj: IState = { b: "world" };
      const result = lf(obj).pi("a").p("name").set("updated");
      expect(result).to.equal(obj);
    });

    it("uses fallback via lf", () => {
      const obj: IState = { b: "world" };
      const defaultNested: INested = { name: "default", child: { value: 0 } };
      const result = lf(obj).pi("a", defaultNested).p("name").set("updated");
      expect(result.a!.name).to.eql("updated");
    });

    it("modify is a no-op via lf when field is undefined", () => {
      const obj: IState = { b: "world" };
      let called = false;
      const result = lf(obj).pi("a").p("name").modify((v) => {
        called = true;
        return v + "!";
      });
      expect(result).to.equal(obj);
      expect(called).to.eql(false);
    });
  });

  describe("prepend with pi()", () => {
    interface IRoot {
      state: IState;
    }

    it("prepend works with optional recording", () => {
      const obj: IRoot = { state: { a: { child: { value: 1 }, name: "hello" }, b: "world" } };
      const recording = lb<IState>().pi("a").p("name").record("updated");
      const prepended = recording.prepend(lb<IRoot>().p("state").get());
      const result = prepended.fn(obj);
      expect(result.state.a!.name).to.eql("updated");
    });

    it("prepend is a no-op when optional field is undefined", () => {
      const obj: IRoot = { state: { b: "world" } };
      const recording = lb<IState>().pi("a").p("name").record("updated");
      const prepended = recording.prepend(lb<IRoot>().p("state").get());
      const result = prepended.fn(obj);
      expect(result).to.equal(obj);
    });

    it("prepend recordModify does not call f when optional field is undefined", () => {
      const obj: IRoot = { state: { b: "world" } };
      let called = false;
      const recording = lb<IState>().pi("a").p("name").recordModify((v) => {
        called = true;
        return v + "!";
      });
      const prepended = recording.prepend(lb<IRoot>().p("state").get());
      prepended.fn(obj);
      expect(called).to.eql(false);
    });
  });

  describe("immutability", () => {
    it("does not mutate the original object on set", () => {
      const obj: IState = { a: { child: { value: 1 }, name: "hello" }, b: "world" };
      const result = lb<IState>().pi("a").p("name").set(obj, "updated");
      expect(obj.a!.name).to.eql("hello");
      expect(result.a!.name).to.eql("updated");
      expect(result).to.not.equal(obj);
    });

    it("does not mutate when using fallback", () => {
      const defaultNested: INested = { name: "default", child: { value: 0 } };
      const obj: IState = { b: "world" };
      const result = lb<IState>().pi("a", defaultNested).p("name").set(obj, "updated");
      expect(defaultNested.name).to.eql("default");
      expect(result.a!.name).to.eql("updated");
    });
  });
});
