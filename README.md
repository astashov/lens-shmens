# LensShmens

TypeScript introspectable lens library, with ability to create "recordings" - delayed lens execution.

# Why would you need it?

Lens is a powerful composable abstraction coming from functional languages, that allow to access and modify immutable data structures in a type safe manner. This library provides `Lens` class, that allows you to build and compose those lens together.

In addition to `Lens` class, it also provides `LensBuilder` classes, so you can quickly build and combine complex lens using simple builder syntax.

Also, those lens are inspectable, you can in runtime check what fields would be changed. That could be useful for logs, for controlling access to your data structure, etc.

And another cool feature - you can create "lens recordings" - a function, that will change the data structure you pass into it according to "prerecorded" rules.

Those features make it pretty convenient to use e.g. with Redux or Redux-like architectures, check it out below!

# How to install

```
$ npm install lens-shmens
```

Or

```
$ yarn add lens-shmens
```

# Usage

Lens is a powerful composable abstraction coming from functional languages, that allow to access and modify immutable data structures in a type safe manner. This library provides those `Lens`, so you could do things like:

```ts
import { Lens } from "lens-shmens";

// Defining the interface of our data structure - a blog, that
// has multiple posts, each post has an author.
interface IPost {
  author: string;
}

interface IBlog {
  posts: IPost[];
}

// Defining the lens for getting/setting first post of a blog.
// We need to provide a 'getter', a 'setter' and from/to hints for lens introspection
const firstPostLens = new Lens<IBlog, IPost>(
  (d) => d.posts[0],
  (d, value) => {
    const newPosts = [...(d.posts || [])];
    newPosts[0] = value;
    return { ...d, posts: newPosts };
  },
  { from: "blog", to: "posts[0]" }
);

// Defining the lens for getting/setting an author of a post
const postAuthorLens = new Lens<IPost, string>(
  (f) => f.author,
  (f, value) => ({ ...f, author: value }),
  { from: "post", to: "author" }
);

// This is probably the most powerful feature of lenses - you can compose
// them together, like here we build a lens to get author of a first blog post
const firstPostAuthorLens = firstPostLens.then(postAuthorLens);

// If you properly specify `from` and `to` for each lens, their `toString()`
// method will give you a hint what they change
firstPostAuthorLens.toString();
// => blog -> posts[0] -> author

firstPostAuthorLens.from;
// => [ "blog", "posts[0]" ]

firstPostAuthorLens.to;
// => "author"

// Let's define an example blog and try to access it
const blog: IBlog = {
  posts: [{ author: "john" }],
};

firstPostLens.get(blog);
// => { author: "john" }

postAuthorLens.get(blog.posts[0]);
// => "john"

firstPostAuthorLens.get(blog);
// => "john"

firstPostAuthorLens.set(blog, "peter");
// Returns a completely new instance, it doesn't mutate any existing data
// => { posts: [{ author: "peter" }] }
```

So, you can create lenses, you can introspect them.
You can define any possible logic in their getter and setter, but most of the time we use lenses to get and set values in deeply nested JavaScript objects, often in an immutable way. For that, there's much simpler syntax for creating those:

```ts
import { Lens } from "lens-shmens";

// This will build the lens same as above, for accessing an author of a first blog post
const firstPostAuthorLens = Lens.build<IBlog, {}>({}).p("posts").i(0).p("author");
```

This is used so often, there's a short-named function `lb` exposed, that is doing the same thing:

```ts
import { lb } from "lens-shmens";

// This will build the lens same as above, for accessing an author of a first blog post
const firstPostAuthorLens = lb<IBlog>().p("posts").i(0).p("author").get();
```

It's all typesafe, so if you make a typo in "posts" or "author", you'll get a type error.

`Lens.build` or `lb` returns `LensBuilder` object, that has the following methods:

- `p`: for accessing the fields in an object.
- `pi`: also for accessing the fields in an object, but in case the previous result may be undefined, it still will typecheck. It's dangerous though - if the previous reuslt was undefined, and you try to access it's field, you'll get a runtime error.
- `i`: for accessing specific index of an array
- `find`: access element of array by condition
- `findBy`: access element of array by key/value (if array contains objects)
- `get`: to finally convert `LensBuilder` to `Lens`

Some examples:

```ts
const postWithAuthorJohnLens = lb<IBlog>()
  .p("posts")
  .find((p) => p.author === "john")
  .get();

// or like that:

const postWithAuthorJohnLens = lb<IBlog>().p("posts").findBy("author", "john").get();
```

## Recordings

There's another unique feature of `LensBuilder`, it may create "**recordings**". The idea is that you
combine the lens itself and the value for a setter, and you get back a function. When you pass
an object into that function, you'll get back another object, with the value applied. For example:

```ts
const blog: IBlog = {
  posts: [{ author: "john" }],
};

const lensBuilder = lb<IBlog>().p("posts").i(0).p("author");
const recording = lensBuilder.record("peter");
// recording looks like this:
// {
//   fn: (obj) => obj,                           // function that will apply the recorded value to the object
//   str: 'obj -> posts -> 0 -> author = peter', // string that describes the recording
//   lens: Lens,                                 // lens that will be applied
//   value: { v: 'peter' },                      // recorded value
//   log: (startName: string) => void,           // logging function
//   type: 'set',                                // could be 'set' or 'modify'
// }
const newBlog = recording.fn(blog);
// => { posts: [ { author: 'peter' } ] }
```

So, the recordings allow you to store the lens and the value it will apply, and also introspect what's the value and what are the fields it will update (via `from` and `to` fields or `lens` field).

### WHY????

Why do we need it though?

I really like Redux (well, or any Redux-like architecture at all, even if it's just `useReducer`). It gives you one funnel ALL the events and state changes are going through. You can introspect every single event, you can add logic based on what events are going through the funnel, you have time-travelling debugger, logging is very simple, most parts of the app become pure, the architecture is very simple yet effective.

But Redux is famous by its boilerplate. To add a new feature, you have to create a new action, create a type for it, create a new case statement in a reducer, and then dispatch that action usually from a React view. All those things may happen in different files, making it pretty hard to reason about.

For example, in my [Liftosaur](https://www.liftosaur.com/about) project, I use the lens recordings together with `useReducer`, and it works pretty well. I have the `UpdateState` action, and its reducer passes the state object into the recordings function. It looks like this:

```ts
// Action type definition
export type IUpdateStateAction = {
  type: "UpdateState";
  lensRecording: ILensRecordingPayload<IState>[];
};

export type IAction = IUpdateStateAction | /* ... */;
```

`lensRecording` contains an array of all recordings we want to apply, and we'll apply them consequently, one by one. The reducer part would look like this:

```ts
function reducer(state: IState, action: IAction): IState {
  switch (action.type) {
    // ...
    case "UpdateState": {
      return action.lensRecording.reduce((previousState, recording) => {
        return recording.fn(previousState);
      }, state);
    }
  }
}
```

And the part where we dispatch the action in e.g. React view could look like this:

```tsx
<input
  type="text"
  onInput={(e) => {
    const newValue = e.currentTarget.value;
    dispatch({
      type: "UpdateState",
      lensRecordings: [lb<IState>().p("posts").i(0).p("author").record(newValue)],
    });
  }}
/>
```

So, whenever we need to add a new feature, it's usually just dispatching new `UpdateState` action with proper `lensRecordings`.

The cool things are:

- we still have a single funnel for all the actions
- lens recordings are introspectable, so we know what fields of the state are about to be changed, and we can react on that appropriately (e.g. forbid the changes of some fields if we need to, or subscribe to changes in specific fields and update other fields base on those)
- changes still happen inside a reducer, so we can centralize our error handling there

Like, we get all the benefits of Redux-like approach + smaller amount of boilerplate. How cool is that!

### Reusability

Even more, since lens are composable by nature, we can reuse the logic as well. For example, we want to be able to edit blog posts in-place, but also we want to have drafts mechanism, so when we finish editing, we could save the draft, or we could discard it.

It makes sense to store currently editing draft in a separate place of a global Redux state. E.g. the state could look like:

```ts
interface IState {
  posts: IPost[];
  currentDraft: IPost;
}
```

We could reuse the lens recording, so it'd work with `IPost`, and we could pass different base based on whether we want to edit the post in-place, or edit a draft. Like:

```tsx
function EditPostAuthor(props: { lensBuilder: LensBuilder<IState, IPost>; dispatch: IDispatch }): JSX.Element {
  return (
    <input
      type="text"
      onInput={(e) => {
        const newValue = e.currentTarget.value;
        props.dispatch({
          type: "UpdateState",
          lensRecordings: [props.lensBuilder.p("author").record(newValue)],
        });
      }}
    />
  );
}
```

And then we'd call it like:

```tsx
import { lb } from "lens-shmens";

<EditPostAuthor lensBuilder={lb<IState>().p("posts").i(0)} dispatch={dispatch}>
```

or

```tsx
import { lb } from "lens-shmens";

<EditPostAuthor lensBuilder={lb<IState>().p("currentDraft")} dispatch={dispatch}>
```

Depending on whether we edit post in-place, or edit a draft, we can pass different lens "bases", and the only their requirement is that they should provide a lens from `IState` to `IPost` (hence `LensBuilder<IState, IPost>` as an argument), but what's in between those two endpoints is not important.

### recordModify

If you need to calculate the value you want to set to recording, you may use `recordModify`, that accepts a function. It looks like this:

```ts
const lensBuilder = lb<IBlog>().p("posts").i(0).p("author");
const recording = lensBuilder.recordModify((author) => `${author} Copy`);
```

The downside of this approach is that introspection of such recording is more limited, since you don't know what happens in the function. So, it's better to use `record` instead of `recordModify` when you can. But if you can't, then you have `recordModify` :)

Sometimes you need access to other parts of the object in `recordModify`. In that case, you can use `lbu` helper function, which accepts an array of lenses, and the resolved values from those lenses will be accessible as a second argument to `recordModify`. For example:

```ts
import { lb, lbu } from "lens-shmens";

const lensGetters = {
  authorOfSecondPost: lb<IBlog>().p("posts").i(1).p("author").get(),
};

const firstPostAuthorLensBuilder = lbu<IBlog, typeof lensGetters>(lensGetters).p("posts").i(0).p("author");
const recording = firstPostAuthorLensBuilder.recordModify((author, getters) => {
  return `${author} and ${getters.authorOfSecondPost}`;
});

const blog: IBlog = {
  posts: [{ author: "john" }, { author: "jane" }],
};

const newBlog = recording.fn(blog);
console.log(newBlog);
// { posts: [{ author: "john and jane" }, { author: "jane" }] }
```

## Use lens builder to modify state in place

So, you can do this:

```ts
const blog: IBlog = {
  posts: [{ author: "john" }],
};

const lens = lb<IBlog>().p("posts").i(0).p("author").get();
const newBlog = lens.set("peter");
// => { posts: [{ author: "peter" }]}
```

There's also a way to make it oneliner, and a bit easier to read, using `lf` helper:

```ts
import { lf } from "lens-shmens";

const blog: IBlog = {
  posts: [{ author: "john" }],
};

const newBlog = lf(blog).p("posts").i(0).p("author").set("peter");
// => { posts: [{ author: "peter" }]}
```

`lf` is useful if you just need to create new instance with changed value, and avoid mutating the original data structure.

## Errors

If a runtime error happens, it throws `LensError` error, that contains:

- descriptive message
- lens where error happens
- type of operation (get or set)
- the original `Error` instance
- if the operation was `set` - the value we tried to set

That should give you enough information for debugging, and also for introspecting the error in runtime and figuring out what operation caused it and what fields were affected.

For example:

```ts
import { lb, LensError } from "./utils/lens";

const blog: IBlog = { posts: [{ author: "john" }] };

// Accessing third element, that doesn't exist in the `blog` variable
const firstPostAuthorLensBuilder = lb<IBlog>().p("posts").i(2).p("author");
const recording = firstPostAuthorLensBuilder.recordModify((author) => author + " and me");

try {
  const newBlog = recording.fn(blog);
} catch (e) {
  if (e instanceof LensError) {
    console.log(e.message);
    // => Error: LensError: Error when getting obj,posts,2 -> author (Cannot read property 'author' of undefined)
    console.log(e.lens);
    // => Lens { get: fn, set: fn, from: [ 'obj', 'posts', '2' ], to: 'author' }
    console.log(e.type);
    // => get
    console.log(e.err);
    // => TypeError: Cannot read property 'author' of undefined
  } else {
    throw e;
  }
}
```
