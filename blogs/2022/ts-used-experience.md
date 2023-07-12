# TS 使用心得分享与启发

> 本次分享主要分享一下过往在使用 TS 的过程中产生的一些心得与经验，启发一下大家对 TS 的理解，不涉及任何原理相关的内容，有兴趣的点可以自行深入查阅

## JS 版本代码

现在有一个通过传一个数组以及传数组里面对象键的函数，进行计算各个键的数值总和进行返回

- 如果有兴趣的小伙伴可以先不要往下阅读，自行实现写一下

```javascript
const mock = new Array(10).fill(1).map(() => ({ a: 1, b: 2, c: 'aaa' }));

const res = combineSum(mock, ['a', 'b', 'c']);

console.log(res); // { a: 10, b: 20, c: 0 }

// 处理函数
function combineSum(array, needSumKeys) {
  const result = needSumKeys.reduce((prev, cur) => {
    prev[cur] = 0;
    return prev;
  }, {});

  if (!array || !array.length) {
    return result;
  }

  for (const item of array) {
    for (const key of needSumKeys) {
      const value = Number(item[key]);
      if (!isNaN(value)) {
        const current = result[key] || 0;
        result[key] = current + value;
      }
    }
  }

  return result;
}
```

## 对组内一些小伙伴的写法分析

小伙伴 A

```typescript
type LimitedSumKeys = string;
type MockItem = Record<LimitedSumKeys, number | string>;
type MockArr = Array<MockItem> | undefined | null;
type LimitedSumKeysArr = Array<LimitedSumKeys>;

// 处理函数
function combineSum(array: MockArr, needSumKeys: LimitedSumKeysArr): MockItem {
  const result: Record<string, number | 0> = needSumKeys.reduce((prev, cur) => {
    prev[cur] = 0;
    return prev;
  }, {} as Record<string, number | 0>);

  if (!array || !array.length) {
    return result;
  }

  for (const item of array) {
    for (const key of needSumKeys) {
      const value = Number(item[key]);
      if (!isNaN(value)) {
        const current = result[key] || 0;
        result[key] = current + value;
      }
    }
  }

  return result;
}
```

小伙伴 B

```typescript
// 处理函数
function combineSum<T>(array: Array<T>, needSumKeys: Array<keyof T>) {
  const result = needSumKeys.reduce((prev, cur) => {
    prev[cur] = 0;
    return prev;
  }, {} as { [key in keyof T]: number });

  if (!array || !array.length) {
    return result;
  }

  for (const item of array) {
    for (const key of needSumKeys) {
      const value = Number(item[key]);
      if (!isNaN(value)) {
        const current = result[key] || 0;
        result[key] = current + value;
      }
    }
  }

  return result;
}
```

小伙伴 C

```typescript
// 处理函数
function combineSum<T, U extends keyof T>(
  array: T[],
  needSumKeys: U[],
): { [key in U]: number } {
  const result = needSumKeys.reduce((prev, cur) => {
    prev[cur] = 0;
    return prev;
  }, Object.create(null));

  if (!array || !array.length) {
    return result;
  }

  for (const item of array) {
    for (const key of needSumKeys) {
      const value = Number(item[key]);
      if (!isNaN(value)) {
        const current = result[key] || 0;
        result[key] = current + value;
      }
    }
  }

  return result;
}
```

## 代码分析

小伙伴 A

- 基本上是刚接触 TS 的同学的写法，声明了需要的类型以及返回，基本达到可以使用的状态，但是也有一些不足:
  - 由于是简单的转化了 ts，其实语义提醒上是不健全的，仅能满足到传入参数是否准确进行校验以及返回的格式的提醒。
  - 返回类型永远都是`Record<string, number | string>`，对于对处理完的数据后续使用 TS 提醒上极度不友好
  - 由于不健全以及声明了一堆类型，所以效率并不高，无论是写的人还是使用的人

小伙伴 B

- 小伙伴 B 是基于泛型的，从代码上直观看得出，这个比小伙伴 A 的写法精简很多，也基本解决了小伙伴 A 的不足，返回类型都有对应正确的提醒，基本能达到一个比较友好的使用状态。不过也存在着一些不足点:
  - 由于没有对泛型对于传入的参数进行控制，可能会误导到使用者，例如`array`传入的是`[1, 2, 3]`，那么 needSumKeys 的提醒则相当于`keyof number`，或`array`传入的是`['a', 'b', 'c']`，那么 needSumKeys 的提醒则相当于`keyof string`
  - 在传入 object 的情况下，基本上返回值的类型基于传入的对象遍历出来，如果`needSumKeys`只传入了 objec 里面的某两个 key，返回值依旧是整个 object 的 key 遍历，这样其实很容易导致后续使用者出现不可预支的异常，例如 needKeys 传入`['b', 'c']`，`res.a` 在使用的时候提醒是`number`，而实则是`undefined`

### 小伙伴 C

- 基本写法与小伙伴 B 一致，解决了小伙伴 B 基本上返回值的类型基于传入的对象遍历的问题，但依旧存在与小伙伴 B 一样的不足点:
  - 由于没有对泛型对于传入的参数进行控制，可能会误导到使用者，例如 array 传入的是`[1, 2, 3]`，那么`needSumKeys`的提醒则相当于`keyof number`，或 array 传入的是`[’a’, ‘b’, ‘c’]`，那么 needSumKeys 的提醒则相当于`keyof string`

## 总结下来，其实在 TS 化的时候会产生以下的小需求

基于传入的参数自动推导正确的返回值方便后续使用

1. `needSumKeys`能基于`array`内部结构自动提醒参数方便代码编写
2. 返回值基于`needSumKeys`传入的值进行推导出有效的结果

### 基于需求优化后的代码

```typescript
// 处理函数
function combineSum<T extends Record<string, any>, NK extends keyof T>(
  array: Array<T>,
  needSumKeys: Array<NK>,
) {
  const result = needSumKeys.reduce((prev, cur) => {
    prev[cur] = 0;
    return prev;
  }, {} as { [key in NK]: number });

  if (!array || !array.length) {
    return result;
  }

  for (const item of array) {
    for (const key of needSumKeys) {
      const value = Number(item[key]);
      if (!isNaN(value)) {
        const current = result[key] || 0;
        result[key] = current + value;
      }
    }
  }

  return result;
}
```

\*\*但是，这样的写法依旧存在缺陷

从原始代码阅读来看，由于是 js 的形式，所以会做一些异常数据的兼容等操作，而基于 TS 的情况，其实还能进一步优化

- 维持代码的兜底逻辑保证程序正常
- 基于 TS 的提醒，提醒使用者不可以传入不能计算的 key 值

例如，其实从实际上来讲`c`是不应该可以拿去计算的，能否从 TS 上就提醒使用者不可以传入`c`呢，所以就再次优化出一个进阶版

### 进阶版代码

```typescript
// 处理函数
function combineSum<
  T extends Record<string, any>,
  NK extends { [P in keyof T]: T[P] extends number ? P : never }[keyof T],
>(array: T[], needSumKeys: NK[]) {
  const result = needSumKeys.reduce((prev, cur) => {
    prev[cur] = 0;
    return prev;
  }, {} as Record<NK, number>);

  if (!array || !array.length) {
    return result;
  }

  for (const item of array) {
    for (const key of needSumKeys) {
      const value = item[key];
      if (typeof value === 'number') {
        const current = result[key] || 0;
        result[key] = current + value;
      }
    }
  }

  return result;
}
```

整个流程下来，其实就涉及了很多 TS 相关的知识点可深入探究

- 基础类型工具(Pick/Record)
- 泛型
- never
- extends(推导/约束)
- ...

其中还包含着组合使用的一些基础用法，例如

- 如何基于泛型和推导自动获取传入数据的类型
- 如何只取出一个 interface 里面指定的基础类型 key: `{ [P in keyof T]: T[P] extends number ? P : never }[keyof T]`
- ...

## 最后的一些总结

1. TS 并不是 JS 的简单增加类型版本，在现代编辑器做得很优秀的情况下，多利用好 TS 的能力，可以提高大家的开发效率以及团队协作效率。
1. 写 TS 的时候，可以尽量的利用 TS 的推导能力去做事情，减少大量重复的声明，减少维护成本
1. 写 TS 最好不要为了就单纯解决红线问题或者声明问题，如果项目大部分是`Record<string, number | string>`这些声明，其实跟没使用 ts 或者全是 any 没啥差别，而应该是想办法榨干 TS 的提醒能力去优化自己的写法，这样可以掌握更多的技巧，也方便了其他项目维护的小伙伴

`最后的最后，希望大家用TS的时候多多追求和深入挖掘，这样会对自己的TS基础和掌握提升得更快更有效。`
