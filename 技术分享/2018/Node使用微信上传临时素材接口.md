# Node使用微信上传临时素材接口

date: 2018/06/20

## 引言

> 在开发小程序后端的时候，遇到需求，需要接受小程序客服信息用户回复的特定指端，返回对应的图片，然而图片是存在oss或者是某些特殊链接转成base64的形式，在使用微信提供的临时素材上传接口的时候，经常返回媒体文件解析错误
> 经过一轮的方法查找，发现基本都是php解决的办法，经过一轮总结网上各路大神的解决方式，终于能得到想要的结果

## 分析

临时素材接口文档地址 [临时素材接口 · 小程序](https://developers.weixin.qq.com/miniprogram/dev/api/custommsg/material.html?t=201868)

从文档分析，上传临时图片有几个点需要注意：

1. 上传图片官方介绍请求的里面media字段是form-data中媒体文件标识，有filename、filelength、content-type等信息
2. 请求不能使用axios，axios服务端貌似不支持表单类型提交，在不新增第三方库的情况下，使用request的form方法，上传
3. 对于oss、线上类型的图片，可以通过axios直接获取图片的stream丢到media里面即可
4. 对于特殊的base64图片，先把base64转换成buffer，再利用request.form，把buffer丢进去media
5. 对于本地的图片，可以使用fs创建一个可读流进行传递

经过对提交`stream`与`buffer`的分析，对于网络请求回来的图片，一般都带有filename等表示，而base64图片是不具备的，所以传输的时候需要补上`contentType`以及`filename`，不然微信会识别失败，具体可查看下文提交部分的代

## 具体代码

### 一、获取根据不同类型获取对应格式

#### OSS、线上类型图片-直接获取stream

通过阅读axios文档，可以发现axios提供直接获取文件stream的功能

```javascript:;
// 直接获取网络图片的Stream

const { data: imgStram } = await axios.get(imgUrl, {
  responseType: 'stream',
});

```

#### base64类型的图片-转成buffer

对于base64格式，需要去掉base的标识，不然图片会无法正确显示

传输的时候需要补上contentType以及filename，不然微信会识别失败

```javascript:;
// 把base64格式的图片转成Buffer

cosnt imgBuffer = Buffer(
  base64Code.replace(/^data:image\/\w+;base64,/, ''), // 去掉base的标识
  'base64',
);

```

#### 对于本地文件-直接创建可读stream

```javascript:;
const imgStram = fs.createReadStream(src))
```

### 二、简单封装request请求

写法基本参考自网上，自己在外面再包一层promise，方便使用async/await

不加上hack微信服务器会识别失败

filename可以写死一个，经过测试，每次微信都会返回不同的media_id，所以不用担心名称重复导致的问题

```javascript:;
function _promiseRequest({ imgStram = null, imgBuffer = null, accessToken }) {
  const url = `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=image`;
  return new Promise((resolve, reject) => {
    const req = request.post(
      {
        url,
        headers: {
          accept: '*/*',
        },
      },
      (err, res) => {
        if (err) {
          reject(err);
        }
 
        try {
          const resData = JSON.parse(res.body); // 里面带有返回的media_id
 
          resolve(resData);
        } catch (e) {
          console.log(e)
        }
      },
    );
 
    const form = req.form();
 
    if (imgBuffer) {
      form.append('media', imgBuffer, {
        contentType: 'image/jpeg', // 微信识别需要
        filename: 'code.jpg', // 微信识别需要
      }); 
    } else if (imgStram) {
      form.append('media', imgStram);
    }
 
    form.append('hack', ''); // 微信服务器的bug，需要hack一下才能识别到对象
  });
}

```

## 最后

安利一个老大推荐去了解stream的仓库 [GitHub - substack/stream-handbook: how to write node programs with streams](https://github.com/substack/stream-handbook)
