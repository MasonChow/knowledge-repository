# 微信小程序授权登陆方案以及在Taro下利用Decorator修饰器实现

data: 2018/09/11

> 选用Taro做技术框架的原因：最近公司需要开发一款新的小程序，主要是做付费知识相关的产品，涉及到了虚拟商品支付，对于IOS的对于虚拟商品支付的种种限制，加上类似小程序的相关调研，决定IOS支付的方式走h5公总号支付绕开限制，所以在框架选型上面需要一套代码加一点兼容代码，就可以生成小程序和H5版本的库，考虑到本身技术栈以react为主，所以最后老大选择了Taro进行开发

## 需求场景

在微信小程序里面，需要做助力、拼团等逻辑的时候，有些需要鉴权的接口等，要再用户授权登录完毕之后，在请求的`header`带上用户的`accessToken`，所以要确保这些接口在用户登录完成之后再开始进行请求

之所以要用户授权登录而不用小程序的静态登录方式，是因为在兼容H5的时候，登陆流程是通过公众号登录的，在不想产生多余的数据下，使用用户的`union_id`作为唯一依据，用`wx.login`这种形式拿用户的`code`登录只能拿到`open_id`，与我们的需求不符合

[UnionID机制说明 · 小程序](https://developers.weixin.qq.com/miniprogram/dev/api/unionID.html)

我们这边与后端约定是先通过用户授权`wx.getUserInfo`，拿到用户信息发送给后端进行注册或者登陆，后端返回一个`accessToken`作为用户的凭证，调用其他接口的时候在`header`带着这个`accessToken`，后端就能在需要的时候根据`accessToken`获取到当前用户信息

### 小程序的登录流程如下

![1272272b-3f6c-416b-9e8a-24ae3b9c2f37.jpg](https://mason-bucket.oss-cn-shenzhen.aliyuncs.com/blog/imgs/1272272b-3f6c-416b-9e8a-24ae3b9c2f37.jpg)

> 由于小程序的生命周期机制，生命周期是异步执行的，生命周期之间是无法阻塞执行，如果在`onLaunch`的时候进行用户登录的逻辑，在弱网的情况下，会出现一种情况就是用户登录没完成的情况下，还没拿到`accessToken`就开始了page里面的请求接口，这样会导致接口报错

### 解决思路

利用修饰器`Decorator`、React的高阶组件`HOC`以及`async/await`，劫持当前页面调用接口的声明周期，等待封装好的用户登录逻辑执行完以后，再进行当前声明周期里面其他调用的执行。

#### 举个例子

在分享助力的场景下，新用户点击分享用户的卡片进来小程序，需要弹出一个授权弹框等用户授权登陆成功以后，才能进行助力接口的调用。

> 要注意的是，劫持的是当前声明周期的方法，并不会阻塞到其他生命周期，例如劫持`willMount`的时候，`didShow`、`didMount`等周期依然会照样按顺序执行，并不会等待`willMount`结束后再进行

### 代码分享

主要分享修饰器的使用以及作用，登陆逻辑主要参考流程图即可，代码暂不做分享

#### 写一个能劫持传入组件生命周期的修饰器

由于Taro暂时不支持无状态组件，所以只能使用HOC的反向劫持能力，继承传入的组件，这个时候就可以通过等待登录逻辑完成，再执行劫持的生命周期

##### withLogin.js

```javascript
const LIFE_CYCLE_MAP = ['willMount', 'didMount', 'didShow'];

/**
 *
 * 登录鉴权
 *
 * @param {string} [lifecycle] 需要等待的鉴权完再执行的生命周期 willMount didMount didShow
 * @returns 包装后的Component
 *
 */
function withLogin(lifecycle = 'willMount') {
  // 异常规避提醒
  if (LIFE_CYCLE_MAP.indexOf(lifecycle) < 0) {
    console.warn(
      `传入的生命周期不存在, 鉴权判断异常 ===========> $_{lifecycle}`
    );
    return Component => Component;
  }
    
  return function withLoginComponent(Component) {
    // 避免H5兼容异常
    if (tool.isH5()) {
      return Component;
    }
      
    // 这里还可以通过redux来获取本地用户信息，在用户一次登录之后，其他需要鉴权的页面可以用判断跳过流程
    // @connect(({ user }) => ({
    //   userInfo: user.userInfo,
    // }))
    class WithLogin extends Component {
      constructor(props) {
        super(props);
      }

      async componentWillMount() {
        if (super.componentWillMount) {
          if (lifecycle === LIFE_CYCLE_MAP[0]) {
            const res = await this.$_autoLogin();
            if (!res) return;
          }

          super.componentWillMount();
        }
      }

      async componentDidMount() {
        if (super.componentDidMount) {
          if (lifecycle === LIFE_CYCLE_MAP[1]) {
            const res = await this.$_autoLogin();
            if (!res) return;
          }

          super.componentDidMount();
        }
      }

      async componentDidShow() {
        if (super.componentDidShow) {
          if (lifecycle === LIFE_CYCLE_MAP[2]) {
            const res = await this.$_autoLogin();
            if (!res) return;
          }

          super.componentDidShow();
        }
      }
    }
      
    $_autoLogin = () => {
      // ...这里是登录逻辑
    }
  }
}

export default withLogin;
```

> 使用的组件内必须有对应定义的生命周期，而且``不能使用箭头函数式``，例如 `componentWillMount(){}` 不能写成 `componentWillMount = () => {}` ，会劫持失败

#### 需要登录鉴权页面的使用方式

##### pages/xxx/xxx.js

```javascript
import Taro, { Component } from '@tarojs/taro';
import { View } from '@tarojs/components';
import withLogin from './withLogin'

@withLogin()
class Index extends Component {
  componentWillMount(){
    console.log('Index willMount')
    // 需要带accessToken调用的接口等 
  }
    
  componentDidMount(){
    console.log('Index didMount')  
  }

  render() {
    console.log('Index render');

    return <View />;
  }
}

export default Index;
```

> 1. 如果在继承的时候使用了redux去connect了数据，使用之后已自动为组件的props附带上connect的数据，被修饰的组件不需要再connect去拿这一个数据, 不然可能会出现报错 `Setting data field "xxx" to undefined is invalid`.

利用修饰器这个特性，我们还可以对小程序做一层浏览打点，分享封装等操作

[Taro下利用Decorator快速实现小程序分享](https://github.com/BryantZhou/blog/issues/7)

### 暂未解决的问题

由于小程序编译的原因，小程序上面不能劫持`render`,  所以在授权登录的时候想弹出`自定义弹窗`引导用户授权的话，需要通过`redux`来控制是否显示弹框以及在页面组件引入`自定义弹窗`的组件

问题参考 [反向继承组件的时候 render()劫持失败 · Issue #465 · NervJS/taro · GitHub](https://github.com/NervJS/taro/issues/465)
