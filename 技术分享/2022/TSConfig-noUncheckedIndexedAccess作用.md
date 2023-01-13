# TSConfig-noUncheckedIndexedAccess作用

在Typescript 4.1版本新增，会在使用索引访问数据时， 添加 `undefined` 类型。

## noUncheckedIndexedAccess解决目的

`noUncheckedIndexedAccess:  false`

```typescript
const arr = [1, 2, 3] // number[]
const a = arr[0] // number
const b = arr[4] // number 但实际应该是undefined

for (let i = 0; i <= arr.length; i++) {
 const num = arr[i]; // number 当i = arr.length的时候，实际为undefined
}
```

通过例子可以看得出来，实际上是`undefined`的类型，依旧被推断初始`number`，会让后续使用逻辑产生无法预知的bug。

**`noUncheckedIndexedAccess:  true`**

```typescript
const arr = [1, 2, 3] // number[]
const a = arr[0] // number | undefined
const b = arr[4] // number | undefined

for (let i = 0; i<= arr.length; i++) {
 const num = arr[i]; // number | undefined
}
```

可以看到后，任何索引的访问都会带上 `undefined` 类型, 毕竟 ts 此时也不确定 arr 具体的形状是啥样了, 甚至是一个空 array 都是有可能的，所以这个时候后续的代码逻辑会主动进行防御性变成，使得更加的安全。

### 建议改法

对于for这种循环的操作，可以考虑用`for in`/`for of`/`forEach`代替，虽然略有性能损耗，但是也是可以接受范围，而且对原有逻辑基本上没有任何变动。如果实际上对性能要求严格使用`for`的话，就需要基于原有逻辑进行保护性的代码编写。

#### 普通取值改造建议

如果是内容不变的数组，直接成常量即可

```typescript
const arr = [1, 2, 3] as const

const a = arr[0] // number
const b = arr[4] // Tuple type 'readonly [1, 2, 3]' of length '3' has no element at index '3'
```

如果是可变数组，还是建议通过if等进行`保护性的写法`解决。

```typescript
const arr = [1, 2, 3];
let a: number;
let b: number;

if(arr[0]){
 a = arr[0] // number
}

if(arr[4]){
 b = arr[4] // number
}
```

#### for类型的改造建议

```typescript
const arr = [1, 2, 3] // number[]

for (let i = 0; i<= arr.length; i++) {
 const num = arr[i]; // number | undefined
}

arr.forEach(num => {
 const num1 = num; // number
})
```
