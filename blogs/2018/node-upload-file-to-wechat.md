# Node 使用微信上传临时素材接口

## 引言

> 在开发小程序后端的时候，遇到需求，需要接受小程序客服信息用户回复的特定指端，返回对应的图片，然而图片是存在 oss 或者是某些特殊链接转成 base64 的形式，在使用微信提供的临时素材上传接口的时候，经常返回媒体文件解析错误
> 经过一轮的方法查找，发现基本都是 php 解决的办法，经过一轮总结网上各路大神的解决方式，终于能得到想要的结果

## 分析

临时素材接口文档地址 [临时素材接口 · 小程序](https://developers.weixin.qq.com/miniprogram/dev/api/custommsg/material.html?t=201868)

从文档分析，上传临时图片有几个点需要注意：

1. 上传图片官方介绍请求的里面 media 字段是 form-data 中媒体文件标识，有 filename、filelength、content-type 等信息
2. 请求不能使用 axios，axios 服务端貌似不支持表单类型提交，在不新增第三方库的情况下，使用 request 的 form 方法，上传
3. 对于 oss、线上类型的图片，可以通过 axios 直接获取图片的 stream 丢到 media 里面即可
4. 对于特殊的 base64 图片，先把 base64 转换成 buffer，再利用 request.form，把 buffer 丢进去 media
5. 对于本地的图片，可以使用 fs 创建一个可读流进行传递

经过对提交`stream`与`buffer`的分析，对于网络请求回来的图片，一般都带有 filename 等表示，而 base64 图片是不具备的，所以传输的时候需要补上`contentType`以及`filename`，不然微信会识别失败，具体可查看下文提交部分的代

## 具体代码

### 一、获取根据不同类型获取对应格式

#### OSS、线上类型图片-直接获取 stream

通过阅读 axios 文档，可以发现 axios 提供直接获取文件 stream 的功能

```javascript:;
// 直接获取网络图片的Stream

const { data: imgStram } = await axios.get(imgUrl, {
  responseType: 'stream',
});

```

#### base64 类型的图片-转成 buffer

对于 base64 格式，需要去掉 base 的标识，不然图片会无法正确显示

传输的时候需要补上 contentType 以及 filename，不然微信会识别失败

```javascript:;
// 把base64格式的图片转成Buffer

cosnt imgBuffer = Buffer(
  base64Code.replace(/^data:image\/\w+;base64,/, ''), // 去掉base的标识
  'base64',
);

```

#### 对于本地文件-直接创建可读 stream

```javascript:;
const imgStram = fs.createReadStream(src))
```

### 二、简单封装 request 请求

写法基本参考自网上，自己在外面再包一层 promise，方便使用 async/await

不加上 hack 微信服务器会识别失败

filename 可以写死一个，经过测试，每次微信都会返回不同的 media_id，所以不用担心名称重复导致的问题

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

安利一个老大推荐去了解 stream 的仓库 [GitHub - substack/stream-handbook: how to write node programs with streams](https://github.com/substack/stream-handbook)
