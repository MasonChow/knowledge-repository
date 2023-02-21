#ErrorBoundary #react #Error #react-hooks 

>文章来源: https://www.developerway.com/posts/how-to-handle-errors-in-react

## 特别注意

[[ErrorBoundary]]一般只会捕获React生命周期过程中产生的错误，所以以下情况并不会触发

- 事件处理触发
- 异步事件
- 服务端渲染
- ErrorBoundary本身的逻辑错误

**所以单单套用ErrorBoundary并不足以兜住所有异常的情况，还需要子组件的代码进一步调整。**

## 解法

解法很简单，只要捕获错误并把错误丢到React更新事件内即可。React官方有了个hack的手段触发[[ErrorBoundary]]([相关React Issues](https://github.com/facebook/react/issues/14981#issuecomment-468460187))

```jsx
setState(() => {
  throw new Error('hi')
})
```

对此可以很快的封装出一些通用的hooks给到组件使用

**useThrowAsyncError.ts**

```jsx
// 声明
const useThrowAsyncError = () => {
  const [state, setState] = useState();

  return (error) => {
    setState(() => throw error)
  }
}

// 使用
const Component = () => {
  const throwAsyncError = useThrowAsyncError();

  useEffect(() => {
    fetch('/xxx').then().catch((e) => {
      // throw async error here!
      throwAsyncError(e)
    })
  }, [])
}
```

也可以对于点击事件等函数进行封装包括一个callback函数

**useCallbackWithErrorHandling.ts**

```jsx
// 声明
const useCallbackWithErrorHandling = (callback) => {
  const [state, setState] = useState();
  
  return (...args) => {
    try {
      callback(...args);
    } catch(e) {
      setState(() => throw e);
    }
  }
}

// 使用
const Component = () => {
  const onClick = () => {
    // do something dangerous here
    throw new Error('click error')
  }

  const onClickWithErrorHandler = useCallbackWithErrorHandling(onClick);

  return <button onClick={onClickWithErrorHandler}>click me!</button>
}
```

在React官方文档也有推荐[react-error-boundary](https://github.com/bvaughn/react-error-boundary)库里面也暴露了个[`useErrorHandler(error?: unknown)`](https://github.com/bvaughn/react-error-boundary#useerrorhandlererror-unknown)来解决同样的问题。