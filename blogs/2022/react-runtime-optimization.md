# 拒绝技术壁垒，通过 React 实现一个贪食蛇小游戏，聊聊运行时性能优化

> 本次分享的内容和想法来源于过往的经历以及自己的一些理解沉淀，面向大量函数式组件应用的运行时性能优化场景聊一聊，授人以鱼不如授人以渔，所有性能优化都得结合实际场景，主要想能启发大家在未来工作中遇到性能问题时候能设计出更合理的方案去解决问题。

## 开篇

一般来说，浏览器帧率在 30-60fps 都能算是流畅，也就是在 16.6ms-33ms 内浏览器要完成一次渲染合成，如果这段时间内由于各种耗时运算等导致用户交互/动画没及时进行渲染合成，那么浏览器就会跳过这次，等待下次在进行渲染合成，就会导致了用户觉得卡顿。如果情况比较严重，甚至用户键盘输入等操作都会有极度缓慢的延时。为何函数式组件容易产生性能隐患等具体相关的内容网上有大量相关的文章大家可以进行查阅，由于篇幅问题这里就不展开谈了。

大家时候是不是经常会遇到以下场景

- 遇到运行卡顿，需要做性能优化，打开控制台一顿分析，找出一些频繁触法渲染的组件，套了个 React.memo 好像就可以完事了
- 对于会传给其他组件的引用类型的数据，好像不套个 memo 或者 callback，总怕引起其他组件的频繁渲染或者渲染死循环
- 一个组件，export 出去的时候总觉得要套个 React.memo，避免被引起性能问题
- 项目里面一堆 useMemo/useCallback 参数里监听了一大堆的依赖
- 谈起 React 性能优化，或者在网上翻阅资料，就常常能看到或说起使用这些方式来进行优化
  - useCallback 缓存函数
  - useMemo 减少运算量
  - React.Memo 缓存组件避免过多次数渲染
  - 使用虚拟滚动处理大列表渲染
  - 使用 React.Lazy 进行组件懒加载
  - 使用 worker 避免 js 计算耗时过长
  - ...等等

概括下来，基本就是使用这三板斧进行性能优化解决大部分卡顿场景

1. 使用 memo + useMemo/useCallback 减少 React 重复渲染
2. 使用虚拟滚动减少 dom 节点
3. 使用 worker 解决耗时 js 运算

最终项目里全是一大堆 useMemo/useCallback 充斥在各个地方，一大堆依赖项监听，一个引用类型的数据漏使用 memo 就导致整个引用缓存崩塌无效，或者漏补充依赖导致实际值更新了，界面依旧展示的是缓存的旧值等等。

而对于 React 运行时优化，往往最多最有效的就是去减少组件无效渲染次数。接下来我们借助一个小游戏聊聊 React 运行时的一些性能优化与组件设计。

## 用 React 实现一个贪食蛇小游戏

对于 React 运行时性能问题在一些 IIM 应用/实时直播应用等中会特别容易出现，由于实时性，这些应用会面临比其他应用更多的频分更新触发组件更新的场景。所以我们做一个贪食蛇游戏，来模拟一下组件被高频触发更新的场景。

贪食蛇游戏应该大家都不会陌生，我们可以操作蛇不断移动吃食物，蛇不断的生长。我们先简单梳理出实现这个小游戏需要做的事情

- 基于宽高生成指定的蛇可运动范围
- 蛇需要一直不断运动，基于方向键变化移动方向
- 随机生成一个食物在可运动范围内
- 蛇吃到食物则变长
- 蛇碰到自己身体则游戏结束

先设计一个游戏的 sdk，提供了以下的能力

- 以坐标 id 为数组提供背景画布(模拟大列表渲染，且无法使用虚拟滚动优化)
- 通过事件订阅通知来触发更新食物坐标、蛇身运动(模拟实时收到 im 信息触发更新)

```jsx
// 初始化配置
export type initOptions = {
  // 画布宽度
  width: number,
  // 画布高度
  height: number,
  // 每格的大小(单位-px)
  size: number,
  // 移动速率(单位毫秒)
  speed: number,
};

// 方块点(X_Y,例如0_0,0_1,1_1)
export type Point = string;

// 身体
export type Body = Point[];

// 食物
export type Feed = Point;

// 背景块列表
export type Blocks = Array<{ id: Point }>;

// 主动事件类型 move 移动 new_feed 新食物 game_over 游戏结束
export type HandleEventTypes = 'move' | 'new_feed' | 'game_over';

// 事件回调内容
export type HandleEventCallbackData = {
  // 当前的身体
  body: Body,
  // 当前的食物坐标
  feed: Feed,
};
```

基于 sdk 能力，我们很快就能实现一个无任何优化的基础的版本，这也是项目中最常见的一些代码。

demo 地址

- 在线 [https://masonchow.github.io/react-share-demo/snake/demo1?size=30&speed=30](https://masonchow.github.io/react-share-demo/snake/demo1?size=30&speed=30)
- 代码 [https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo1.tsx](https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo1.tsx)

```jsx
// 示例代码，真实能运行代码请查看 ....
import React, { useEffect, useState } from 'react';
import Snake from 'snake';

export const snake = new Snake({
  width: window.innerWidth,
  height: window.innerHeight,
  size: 30,
  speed: 30,
});

const Block = ({ isActive }: { isActive: boolean }) => {
  return <div className={['block', isActive && 'active'].join(' ')}></div>;
};

function App() {
  // 蛇身
  const [snakeBody, setSnakeBody] = useState<string[]>([]);
  // 食物
  const [feed, setFeed] = useState('');

  useEffect(() => {
    const event = snake.on((type, data) => {
      if (type === 'move') {
        setSnakeBody(data.body);
      }
      if (type === 'new_feed') {
        setFeed(data.feed);
      }
    });

    return () => {
      event.off();
    };
  }, []);

  return (
    <div style={snake.backgroundStyle}>
      {snake.blocks.map((block) => (
        <Block
          isActive={snakeBody.includes(block.id) || feed === block.id}
          key={block.id}
        />
      ))}
    </div>
  );
}

export default App;
```

这里的代码在数据量长度万级的时候还是感觉比较流畅的，毕竟 react 已经做了相当多的优化，伴随着我们把 size 和 speed 逐渐调低，整个游戏就会开始变得卡顿。

## 性能测算

做性能优化之前，我们经常会听到这样的话术，用什么指标来定义是否存在卡顿，又通过什么指标来衡量这次优化结果是有效的。那么我们在正式开始性能测算之前，也来先定义好几个数据指标和采集手段。

### 基础环境

- 机器：mac m1 + 16G
- 浏览器：chrome v102
- React 版本：v18 dev 模式 (验证过 v18 新的并发渲染特性与 v17 的比起来数据差别不大，所以选择 v18 版本来测试)
  - 题外话: 模拟验证手段，根据 v18 版本的 react 文档可以看出，使用让 react 有不同渲染模式
    - concurrent rendering → ReactDomClient.createRoot(dom).render(App)
    - async rendering → ReactDOM.render(App, dom);
- 更新速率: 30ms 触发一次更新

### 数据采集

#### 卡顿定义

由于 sdk 内部是通过 setInterval 进行蛇身移动实现，所以我们可以简单点的认为，如果两次移动的间隔大于设置的间隔时间，那么就已经存在不符合预期的行为，也就是存在卡顿了。

- sdk 内部储存最近一百次的速率
- 基于 sdk 移动事件回调，算出近百次速率平均值

### 基础版本性能测算

| 格子 size | 总数量 | 平均速率 |
| --------- | ------ | -------- |
| 20        | 1800   | 30       |
| 10        | 7200   | 30       |
| 5         | 28800  | 105      |
| 3         | 80000  | 295      |
| 1         | 720000 | 3311     |

### 优化版本一：基础版本增加 Memo

再来个 React.memo 包裹 Block 组件重新测算一次看看 Memo 能有多少提升

demo 地址

- 在线 [https://masonchow.github.io/react-share-demo/snake/demo2?size=30&speed=30](https://masonchow.github.io/react-share-demo/snake/demo1?size=30&speed=30)
- 代码 [https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo2.tsx](https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo1.tsx)

```jsx
const Block = React.memo(({ isActive }: { isActive: boolean }) => {
  return <div className={['block', isActive && 'active'].join(' ')}></div>;
});
```

| 格子 size | 总数量 | 基础版平均速率 | 优化版本一平均速率 |
| --------- | ------ | -------------- | ------------------ |
| 20        | 1800   | 30             | 30                 |
| 10        | 7200   | 30             | 30                 |
| 5         | 28800  | 105            | 51                 |
| 4         | 45000  | 172            | 83                 |
| 3         | 80000  | 295            | 154                |
| 2         | 180000 | 699            | 373                |
| 1         | 720000 | 3311           | 2040               |

从数据上可以看的出来，套 Memo 的性能提升是真的大，在接近万级的数据量级下，游戏依旧能符合我们的预期来运行，就一行改造，效果提升明显，简单又暴力。但是好像瓶颈也就到了支撑万级出头左右的数据量了，再往上的两万量级就开始没法流畅运行了。而且在实际的业务代码中，各种组件层级往往很深，而且数据来源也错综复杂，如果无脑使用 memo 往往带来的就是这个组件的数据来源都要使用 useMemo/useCallback 进行包裹。项目就有种一处 memo，处处 memo 的感觉。

React.Memo 虽然可以解决问题，但并不一定是最合理的解决方案，面对不同的性能场景，不同的业务场景，性能优化更应该要从合理性的角度去分析以及改造问题组件。

如果大家有兴趣自行尝试的话，可以先停下来阅读，下载代码自己也尝试优化，看看能优化到哪个量级。

## 合理性设计组件

这里有一篇很好的文章谈谈一些不一样的组件设计技巧，为了减少大家的时间，下面内容会简单摘取部分内容来简单讲述下。借助这篇文章内容启发一下大家对 React 组件编写的一些思路。

[Before You memo()](https://overreacted.io/before-you-memo/)

先看代码，这里是一个很简单的组件，在 input 输入色值，则能动态更改文本的颜色。里面顺便引入了一个有性能隐患的组件模拟渲染耗时过长

```jsx
import { useState } from 'react';

export default function App() {
  let [color, setColor] = useState('red');
  return (
    <div>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      <p style={{ color }}>Hello, world!</p>
      <ExpensiveTree />
    </div>
  );
}

function ExpensiveTree() {
  let now = performance.now();
  while (performance.now() - now < 100) {
    // Artificial delay -- do nothing for 100ms
  }
  return <p>I am a very slow component tree.</p>;
}
```

一般来说，只要在 ExpensiveTree 组件套用一个 React.memo 就可以解决问题，实际上很多实际的场景就是这样进行优化的。我们看看其他不一样的思路。

### 下移 State

把 setState 的内容下沉封装到组件内部实现，这样就能避免 ExpensiveTree 多余的渲染了

```jsx
export default function App() {
  return (
    <>
      <Form />
      <ExpensiveTree />
    </>
  );
}

function Form() {
  let [color, setColor] = useState('red');
  return (
    <>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      <p style={{ color }}>Hello, world!</p>
    </>
  );
}
```

### 内容提升

有时候，state 内容在更高层的时候，并不能下移封装。如下代码

```jsx
export default function App() {
  let [color, setColor] = useState('red');
  return (
    <div style={{ color }}>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      <p>Hello, world!</p>
      <ExpensiveTree />
    </div>
  );
}
```

那么我们可以尝试一下把内容提升，这有点类似 HOC 的写法。

```jsx
export default function App() {
  return (
    <ColorPicker>
      <p>Hello, world!</p>
      <ExpensiveTree />
    </ColorPicker>
  );
}

function ColorPicker({ children }) {
  let [color, setColor] = useState('red');
  return (
    <div style={{ color }}>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      {children}
    </div>
  );
}
```

简单归纳总结一下这一部分内容，这里也没啥黑魔法以及高大上的内容，都是一些大家都知道的 React 基础原理，这是大家可能做性能优化的时候很容易就没想起来的优化手段。做性能优化，最重要的一点就是分析，分析问题点，深入分析问题代码块，结合自己掌握的知识，评估出合理的优化手段。

## 代码块性能问题分析

在做性能优化之前，我们首先要做好充足的分析，才能有去设计更好的方案尝试优化，所以首先我们先来分析一下基础代码的问题点。

```jsx
function App() {
  const [snakeBody, setSnakeBody] = useState<string[]>([]);
  const [feed, setFeed] = useState('');

  useEffect(() => {
    ...
  }, []);

  return (
    <div style={snake.backgroundStyle}>
      {snake.blocks.map((block) => (
        <Block
          isActive={snakeBody.includes(block.id) || feed === block.id}
          key={block.id}
        />
      ))}
    </div>
  );
}

export default App;
```

代码的问题很容易就看得出来了

1. 当背景块量级上去之后，map 循环会耗费大量的 js 资源
2. 每次移动都会 setBody，都会走一遍 map，让 block 都触发一次 render

我们再来分析分析整个游戏运行过程

1. 移动的过程中，实际有状态变化的也就两个格而已，把尾的去掉，头部增加一个就完成了整个移动的过程。
2. 吃掉食物则是把食物的格子并到身体内再随机有一个格子激活。

分析完之后就很快速得出一个需要实现的目标了

1. 背景生成的大循环只走一次
2. 只触发两个格子状态更新

## 进一步优化探索

## 优化版本二-使用 useMemo+useContext 来减少大循环性能损耗

基于分析，先把背景生成大逻辑抽离出来，只走一次，然后 block 组件通过 context 的数据来决定自己是否被激活

demo 地址

- 在线 [https://masonchow.github.io/react-share-demo/snake/demo3?size=30&speed=30](https://masonchow.github.io/react-share-demo/snake/demo1?size=30&speed=30)
- 代码 [https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo3.tsx](https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo1.tsx)

```jsx
import React, { useEffect, useMemo, useState, useContext } from 'react';
import Snake from 'snake';

export const SnakeContext = React.createContext<{
  body: string[];
  feed: string;
}>({ body: [], feed: '' });

function Block({ id }: { id: string }) {
  const context = useContext(SnakeContext);
  const isActive = context.body.includes(id) || context.feed === id;

  return useMemo(() => {
    return <div className={['block', isActive && 'active'].join(' ')} />;
  }, [isActive]);
}

function Demo() {
  const [snakeBody, setSnakeBody] = useState<string[]>(snake.body);
  const [feed, setFeed] = useState(snake.feed);

  useEffect(() => {
    const event = snake.on((type, data) => {
      if (type === 'move') {
        setSnakeBody(data.body);
      }

      if (type === 'new_feed') {
        setFeed(data.feed);
      }
    });

    return () => {
      event.off();
    };
  }, []);

  const background = useMemo(() => {
    return (
      <div style={snake.backgroundStyle}>
        {snake.blocks.map((block) => (
          <Block key={block.id} id={block.id} />
        ))}
      </div>
    );
  }, []);

  return (
    <SnakeContext.Provider value={{ body: snakeBody, feed }}>
      {background}
    </SnakeContext.Provider>
  );
}

export default Demo;
```

性能测算

| 格子 size | 总数量 | 基础版平均速率 | 优化版本一平均速率 | 优化版本二平均速率 |
| --------- | ------ | -------------- | ------------------ | ------------------ |
| 20        | 1800   | 30             | 30                 | 30                 |
| 10        | 7200   | 30             | 30                 | 30                 |
| 5         | 28800  | 105            | 51                 | 49                 |
| 4         | 45000  | 172            | 83                 | 80                 |
| 3         | 80000  | 295            | 154                | 146                |
| 2         | 180000 | 699            | 373                | 352                |
| 1         | 720000 | 3311           | 2040               | 1736               |

从指标看下来，好像是有点点提升，但是提升得不够明显，通过控制台观察，这种方式虽然避免了大循环，但是每个组件由于取了 context 的数据，context 一直变化的情况下，每个组件也会触发一次 render，还是存在大量的性能损耗，所以优化的效果依旧有点差强人意。

## 优化版本三-结合订阅者模式，基于通知按需更新组件状态

如果 context 机制下会全量触发组件渲染，那么我们需要的就是想办法如何只让有状态变更的组件才触发一次更新，这样订阅者模式就很适合用在这个场景了。

- 基于 id 进行绑定订阅，按需通知到存在状态变更的组件

demo 地址

- 在线 [https://masonchow.github.io/react-share-demo/snake/demo4?size=30&speed=30](https://masonchow.github.io/react-share-demo/snake/demo1?size=30&speed=30)
- 代码 [https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo4.tsx](https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo1.tsx)

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { snake } from 'snake';

type SubscribeChangeFn = (active: boolean) => void;

const Block = ({
  id,
  subscribeChange,
}: {
  id: string;
  subscribeChange: (id: string, fn: SubscribeChangeFn) => void;
}) => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // 订阅变更
    if (subscribeChange && id) {
      subscribeChange(id, (active) => {
        setIsActive(active);
      });
    }
  }, [id, subscribeChange]);

  return (
    <div
      className={['block', isActive && 'active'].filter(Boolean).join(' ')}
    />
  );
};

function Demo() {
  const ref = useRef<{
    snakeBody: string[];
    feed: string;
    subscribeBlocks: Map<string, SubscribeChangeFn>;
  }>({
    snakeBody: snake.body,
    feed: snake.feed,
    subscribeBlocks: new Map(),
  });

  const subscribeChange = (id: string, fn: SubscribeChangeFn) => {
    ref.current.subscribeBlocks.set(id, fn);
  };

  useEffect(() => {
    const initRef = { ...ref.current };
    const { subscribeBlocks, snakeBody, feed } = initRef;

    // 针对id发布订阅
    function publichChange(id: string, isActive: boolean) {
      subscribeBlocks.get(id)?.(isActive);
    }

    // 初始显示身体和食物
    [...snakeBody, feed].forEach((e) => {
      publichChange(e, true);
    });

    const event = snake.on((type, data) => {
      const { snakeBody } = ref.current;
      const { body, feed } = data;

      if (type === 'move') {
        const next = body[0];
        const last = snakeBody[snakeBody.length - 1];
        // 显示头部
        publichChange(next, true);
        // 消时尾部
        publichChange(last, false);
        ref.current.snakeBody = body;
      }

      if (type === 'new_feed') {
        publichChange(feed, true);
      }
    });

    return () => {
      event.off();
      ref.current = initRef;
    };
  }, []);

  return (
    <div style={snake.backgroundStyle}>
      {snake.blocks.map((block) => (
        <Block key={block.id} id={block.id} subscribeChange={subscribeChange} />
      ))}
    </div>
  );
}

export default Demo;
```

性能测算

| 格子 size | 总数量 | 基础版平均速率 | 优化版本一平均速率 | 优化版本二平均速率 | 优化版本三平均速率 |
| --------- | ------ | -------------- | ------------------ | ------------------ | ------------------ |
| 20        | 1800   | 30             | 30                 | 30                 | 30                 |
| 10        | 7200   | 30             | 30                 | 30                 | 30                 |
| 5         | 28800  | 105            | 51                 | 49                 | 30                 |
| 4         | 45000  | 172            | 83                 | 80                 | 33                 |
| 3         | 80000  | 295            | 154                | 146                | 54                 |
| 2         | 180000 | 699            | 373                | 352                | 143                |
| 1         | 720000 | 3311           | 2040               | 1736               | 587                |

这个版本可以看得出来整体上提升相当的大，已经能应付 4 万的数据量了，可能代码阅读上比较绕，而且跟 React 的日常使用写法相差得有点远，但是如果在一些需要极致性能的场景下，需要的就是结合各种机制来达到最终目的。用户并看不到代码实现，只能看到系统，所以最终交付的结果才是最重要的。不管白猫还是黑猫，能捉到老鼠就是好猫。

> 正常来说优化到这个量级，已经差不多了可以完事了，但这就是极限了吗，要不试试把 8 万量级也拿下看看。

## 优化版本四-文艺复兴，一个 Render 都不触发

当组件量级上去之后，无论怎么优化，我们都绕不开底层的 react 进行 dom diff，那么如果不做 diff，那么是不是这一层我们也能优化掉了。所以这次我们从样式表入手，通过更新样式表来达成效果。

demo 地址

- 在线 [https://masonchow.github.io/react-share-demo/snake/demo5?size=30&speed=30](https://masonchow.github.io/react-share-demo/snake/demo1?size=30&speed=30)
- 代码 [https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo5.tsx](https://github.com/MasonChow/react-share-demo/blob/main/src/pages/Snake/Demo1.tsx)

```jsx
import { useEffect } from 'react';
import { snake } from 'snake';

function createStyle(items: string[]) {
  const text = items
    .map((id) => {
      return `
        #id_${id} {
          background: #000;
        }
      `;
    })
    .join('');
  return text;
}

function useUpdatStyle(sdk: typeof snake) {
  useEffect(() => {
    const styleId = 'snake-active';
    const head = document.head;
    const style = document.createElement('style');
    style.setAttribute('id', 'snake-active');
    style.setAttribute('type', 'text/css');
    style.innerHTML = createStyle([...snake.body, snake.feed]);
    head.appendChild(style);

    const event = snake.on((type, data) => {
      const { body, feed } = data;

      if (['move', 'new_feed'].includes(type)) {
        const style = document.getElementById(styleId);
        if (style) {
          style.innerHTML = createStyle([...body, feed]);
        }
      }
    });

    return () => {
      event.off();
    };
  }, [sdk]);
}

const Block = ({ id }: { id: string }) => {
  return <div className="block" id={`id_${id}`} data-id={id}></div>;
};

function Demo() {
  useUpdatStyle(snake);

  return (
    <div style={snake.backgroundStyle}>
      {snake.blocks.map((block) => (
        <Block key={block.id} id={block.id} />
      ))}
    </div>
  );
}

export default Demo;
```

性能测算

| 格子 size | 总数量 | 基础版平均速率 | 优化版本一平均速率 | 优化版本二平均速率 | 优化版本三平均速率 | 优化版本四平均速率 |
| --------- | ------ | -------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| 20        | 1800   | 30             | 30                 | 30                 | 30                 | 30                 |
| 10        | 7200   | 30             | 30                 | 30                 | 30                 | 30                 |
| 5         | 28800  | 105            | 51                 | 49                 | 30                 | 30                 |
| 4         | 45000  | 172            | 83                 | 80                 | 33                 | 30                 |
| 3         | 80000  | 295            | 154                | 146                | 54                 | 30                 |
| 2         | 180000 | 699            | 373                | 352                | 143                | 65                 |
| 1         | 720000 | 3311           | 2040               | 1736               | 587                | 260                |

成功拿下 8 万量级，甚至在 18 万的时候实际运行起来感觉还行。这时候我们看看代码，一个 memo 都没有都可以做到这个地步。这时候应该会有不少小伙伴有疑惑，这种手法在实际业务项目中无法使用吧。是的，这个是针对这个游戏运行特性分析出来的做法。

| 格子 size | 总数量 | 基础版平均速率 | 优化版本一平均速率 | 优化版本二平均速率 | 优化版本三平均速率 | 优化版本四平均速率 |
| --------- | ------ | -------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| 20        | 1800   | 30             | 30                 | 30                 | 30                 | 30                 |
| 10        | 7200   | 30             | 30                 | 30                 | 30                 | 30                 |
| 5         | 28800  | 30             | 30                 | 30                 | 30                 | 30                 |
| 4         | 45000  | 36             | 30                 | 30                 | 30                 | 30                 |
| 3         | 80000  | 60             | 46                 | 52                 | 30                 | 30                 |
| 2         | 180000 | 162            | 128                | 150                | 70                 | 66                 |
| 1         | 720000 | 918            | 782                | 762                | 280                | 252                |

从数据上看，跟 react 官方文档描述得差不多，比起 dev，构建之后运行速度确实快了一个数量级，同时由于版本四的优化是脱离 react 机制的优化，所以指标基本一致，证明了这次的测试下来，结论是可信的。

版本三的思路在生产环境下，基本上能撑得住 8 万量级的数据量，在需要对大数据优化的情况下是一种不错的思路也能更贴合业务场景。而没有优化的版本在接近 3 万的数据量级的情况下依旧是可以流畅运行，所以 React 其实在性能优化上已经做了很多的工作了，基于过往的优化经验，业务代码的慢有时候可能是从数据源更新到最终 UI 渲染之前，经历了很多次对同一个数据源多次重复的循环处理导致的 JS 执行慢而已。如果这个时候仔细再次回顾分析代码。其实还可以发现版本一、版本二其实会随着游戏进程的推进，蛇身越长，则会越来越卡顿，因为里面是基于 includes 来判断激活的，这里也是一个性能隐患点，数据上和版本三/版本四会拉开得越来越大。

## 总结

为什么选贪食蛇这个游戏来当例子，因为这个游戏简单之余，整个过程下来，可以通过简单的分析优化，涵盖到各个方面的内容。同时这也能很好传达我惯穿整个分享最想表达的东西，性能优化没有固定的手法手段，需要结合业务场景，结合代码，结合整体的链路，结合自己的知识去进行分析，再不断给自己设定更高的目标去挑战，突破自己，尝试突破认知极限，这样的过程下来，会能发现自己在这个过程中掌握了很多的知识。

> 那么也可能有人问 72 万的量级也能优化到流畅吗？说不定呢，技术无止境，canvas 可能就是一种方向，这个就留给有兴趣的小伙伴去尝试了。

## 对于 React 性能优化的一些建议

1. 使用 React.memo 建议是往高的父级组件，从顶部渲染优化开始解决问题
2. 不要过度恐慌出现重渲染，有时候减少数据处理几次循环比解决重渲染更有效
3. 优化的程度看业务需求，越极致的优化代码在维护和迭代的方面会越来越麻烦，多人协作的项目可维护性很重要
4. 在优化之前花多点实际理解问题代码逻辑以及业务逻辑，挖掘问题根源，结合业务特色设计优化方案，说得清楚才做得好优化。
5. 建议深入理解 React 设计单向数据流的初衷，React 定位是 UI 框架，所以如何用数据驱动 UI，数据与 UI 分离这是个值得思考的方向。

感谢大家看到这里，欢迎大家多多交流，共同进步。
