# [探索] 利用promise做一个请求锁

data: 2018/07/20

> 在最近开发小程序的过程中，遇到一个需求，就是请求的时候header需要带上accessToken, accessToken是通过登陆接口返回的参数，可能会出现过期的情况，则需要重新登陆，所以每次加载小程序都会进行一次本地储存的accessToken校验，但是再小程序的运行机制下，app的onLaunch，加载pages的onLoad会并发执行，在弱网的情况下，并发可能导致accessToken还没校验完，page的请求函数就开始执行了，这样很容易会导致接口异常，本来的解决办法是在每个page页面调接口之前都await一下app.js里面checkAccessToken的方法，但是这样写起来不太友好

解决思路：

在request的基础上封装多一层锁，当accessToken校验完成之前，其他进来的请求都进行等待，不进行请求，等待校验完成，才开始其他请求

## 原理分析

1. 对原有的request请求做一次封装
2. 利用promise的特性以及js对象存储在内存的特性, 配合async/await，让其他请求等待关键请求完成再开始请求，从而实现请求锁
3. 首先等待关键请求完成了，再通过返回进入判断是否经过需要

### 代码分析

#### 首先模拟一次请求

```javascript:;
// 模拟一次请求发起
const mockRequest = (name, time = Math.random() * 1000) =>
  new Promise(resolve => {
    console.log(`${name}---------------run`);
    setTimeout(() => {
      resolve(`${name}---------------done`);
    }, time);
  });

```

#### 定义请求锁

请求锁要管理两种状态，一种是关键请求进行是状态，一种是当关键请求失败了之后，需要等待辅助操作完成的状态

```javascript:;
const lock = { wait: null, running: null };

```

#### 在request的基础上加一层封装

1. 参数设置两种，withOutLock用于某些不需要等待的请求直接跳过逻辑，lockOthers用于锁住在关键请求之后进来的请求
2. 关键请求进来直接执行，`lock.running`直接赋予关键请求的pending状态，当其他请求进来的时候，都直接等待，不进行请求发起，等主要请求进来完成之后，其他才开始执行

```javascript:;

// 封装模拟request
const request = async (
  name,
  opts = { withOutLock: false, lockOthers: false, hasErr: false }
) => {
  // 不需要等待的请求直接执行
  if (opts.withOutLock) {
    const res = await mockRequest(`${name} - withOutLock`);

    console.log(res);
    return;
  }

  // 关键请求未执行完成 其他请求进入等待状态
  if (lock.running) {
    console.log(`${name}---------------waiting...`);
    await lock.running;
  }

  // 锁住之后进来的请求
  if (opts.lockOthers) {
    lock.running = mockRequest(name, 4000);
    let res = await lock.running;
    // 清空进行锁
    lock.running = null;

    // 模拟关键请求失败的 需要再次等待其他操作的情况 例如重新登陆等
    if (opts.hasErr) {
      lock.wait = mockRequest("关键请求异常处理", 4000);
    } else {
      console.log(res);
      return;
    }
  }

  // 等待模拟关键请求失败的处理
  if (lock.wait) {
    console.log(`等待关键请求异常处理中...`);
    await lock.wait;
    // 清空等待锁
    lock.wait = null;
    console.log(`关键请求异常处理完成`);
  }

  const res = await mockRequest(name);

  console.log(res);

  return;
};

```

### 模拟运行效果

```javascript:;

// 并发请求模拟
const mockConcurrent = () => {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      request(`并发请求${i}`, { withOutLock: i === 0 });
    }, Math.random() * 100);
  }
};

request("关键请求 - 其他需要等待完成才能进行", {
  lockOthers: true,
  hasErr: false
});

mockConcurrent();

```

运行时效果

![7bf191c2-3648-4fc7-82ef-0378ab0bea89.png](https://mason-bucket.oss-cn-shenzhen.aliyuncs.com/blog/imgs/7bf191c2-3648-4fc7-82ef-0378ab0bea89.png)

### 最后

经过同事的指点，未来还打算探究一下请求池，做请求上下文之类的实现

## demo代码

```javascript
/**
 * 请求锁探索
 *
 * by: MasonChow
 */

const mockRequest = (name, time = Math.random() * 1000) =>
  new Promise(resolve => {
    console.log(`${name}---------------run`);
    setTimeout(() => {
      resolve(`${name}---------------done`);
    }, time);
  });

// 请求锁
const lock = { wait: null, running: null };

// 封装模拟request
const request = async (
  name,
  opts = { withOutLock: false, lockOthers: false, hasErr: false }
) => {
  // 不需要等待的请求直接执行
  if (opts.withOutLock) {
    const res = await mockRequest(`${name} - withOutLock`);

    console.log(res);
    return;
  }

  // 关键请求未执行完成 其他请求进入等待状态
  if (lock.running) {
    console.log(`${name}---------------wating...`);
    await lock.running;
  }

  // 锁住之后进来的请求
  if (opts.lockOthers) {
    lock.running = mockRequest(name, 4000);
    let res = await lock.running;
    // 清空进行锁
    lock.running = null;

    // 模拟关键请求失败的 需要再次等待其他操作的情况 例如重新登陆等
    if (opts.hasErr) {
      lock.wait = mockRequest("关键请求异常处理", 4000);
    } else {
      console.log(res);
      return;
    }
  }

  // 等待模拟关键请求失败的处理
  if (lock.wait) {
    console.log(`等待关键请求异常处理中...`);
    await lock.wait;
    // 清空等待锁
    lock.wait = null;
    console.log(`关键请求异常处理完成`);
  }

  const res = await mockRequest(name);

  console.log(res);

  return;
};

// 并发请求模拟
const mockConcurrent = () => {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      request(`并发请求${i}`, { withOutLock: i === 0 });
    }, Math.random() * 100);
  }
};

request("关键请求 - 其他需要等待完成才能进行", {
  lockOthers: true,
  hasErr: false
});

mockConcurrent();
```

纯技术探索，坑点未知，欢迎指出错误以及不足的地方
