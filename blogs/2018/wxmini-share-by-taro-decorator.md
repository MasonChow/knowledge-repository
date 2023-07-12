# Taro 下利用 Decorator 快速实现小程序分享

## 关于微信分享逻辑

### 微信小程序下开发转发有两个途径

1. 在 Page 的`onLoad`里面定义`wx.showShareMenu()`显示当前页面的转发按钮
2. 使用`button`的`open-type=share`让用户点击按钮触发转发

如果需要对当前页面转发进行自定义编辑，则需要再当前页面 Page 中定义 `onShareAppMessage` 事件处理函数，自定义该页面的转发内容。

官方相关文档 [转发 · 小程序](https://developers.weixin.qq.com/miniprogram/dev/api/share.html)

## 痛点

### 使用原生微信转发主要有以下痛点

1. 需要转发的页面都要写一次`wx.showShareMenu()`
2. 如果分享涉及一些统一的逻辑处理，则要么要引入一个类似`format`的函数进行处理，或者每个页面单独写一次

> 在每次分享的卡片的链接上，都需要带上当前分享用户的`userId`，方便日后对于用户拉新分析，助力，团购等行为进行处理，这个时候就需要对分享卡片的路径进行一次处理

### 解决方式

利用`Decorator`以及 React 的高阶组件`HOC`，在`willMount`的时候往页面注入`wx.showShareMenu()`，然后可通过参数或者在当前页面触发响应的设置函数进行相应的分享配置设置

### 代码分享

#### 分享修饰器

##### withShare.js

```javascript
import Taro from '@tarojs/taro';
import { connect } from '@tarojs/redux';
import defaultShareImg from 'xxx.jpg';

function withShare(opts = {}) {
  // 设置默认
  const defaultPath = 'pages/index/index?';
  const defaultTitle = '默认标题';
  const defaultImageUrl = defaultShareImg;

  return function demoComponent(Component) {
    // redux里面的用户数据
    @connect(({ user }) => ({
      userInfo: user.userInfo,
    }))
    class WithShare extends Component {
      async componentWillMount() {
        wx.showShareMenu({
          withShareTicket: true,
        });

        if (super.componentWillMount) {
          super.componentWillMount();
        }
      }

      // 点击分享的那一刻会进行调用
      onShareAppMessage() {
        const { userInfo } = this.props;

        let { title, imageUrl, path = null } = opts;

        // 从继承的组件获取配置
        if (this.$setSharePath && typeof this.$setSharePath === 'function') {
          path = this.$setSharePath();
        }

        // 从继承的组件获取配置
        if (this.$setShareTitle && typeof this.$setShareTitle === 'function') {
          title = this.$setShareTitle();
        }

        // 从继承的组件获取配置
        if (
          this.$setShareImageUrl &&
          typeof this.$setShareImageUrl === 'function'
        ) {
          imageUrl = this.$setShareImageUrl();
        }

        if (!path) {
          path = defaultPath;
        }

        // 每条分享都补充用户的分享id
        // 如果path不带参数，分享出去后解析的params里面会带一个{''： ''}
        const sharePath = `${path}&shareFromUser=${userInfo.shareId}`;

        return {
          title: title || defaultTitle,
          path: sharePath,
          imageUrl: imageUrl || defaultImageUrl,
        };
      }

      render() {
        return super.render();
      }
    }

    return WithShare;
  };
}

export default withShare;
```

#### 使用的页面

##### pages/xxx/xxx.js

```javascript
import Taro, { Component } from '@tarojs/taro';
import { connect } from '@tarojs/redux';
import { View } from '@tarojs/components';
import withShare from './withShare';

@withShare({
  title: '可设置分享标题',
  imageUrl: '可设置分享图片路径',
  path: '可设置分享路径',
})
class Index extends Component {
  // $setSharePath = () => '可设置分享路径(优先级最高)'

  // $setShareTitle = () => '可设置分享标题(优先级最高)'

  // $setShareImageUrl = () => '可设置分享图片路径(优先级最高)'

  render() {
    return <View />;
  }
}
```

> 由于是继承传入的组件，所以获取分享配置除了可以从函数的参数获取，还可以通过定义的一些方法，通过继承的组件获取到继承的参数，这样可以再某些业务场景下，根据需要动态生成分享参数配置，例如代码里面的`this.$setSharePath()`等就是从父级组件动态获取到分享的参数

### 相关参考资料

对于 React 高阶组件的理解可参考 [深入理解 React 高阶组件 - 简书](https://www.jianshu.com/p/0aae7d4d9bc1)

对于 ES7 修饰器的理解可参考 [使用 ES decorators 构建一致性 API | Taobao FED | 淘宝前端团队](http://taobaofed.org/blog/2017/04/27/building-consistent-api-with-es-decorators/)
