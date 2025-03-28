这是一个概念验证项目，只用于演示。希望各位大佬能开发出更好用的工具吧。

#### 原理
客户端接收到浏览器发送过来的 HTTP 代理请求时，把要访问的网址和本机地址用 GET 请求发送到服务器，然后断开和服务器的连接。服务器收到请求数据时，连接到目标网站同时用 websocket 协议回连本机，然后中转数据。回连需要本机有公网地址，其中一种办法是用 cloudflared 把 websocket relay 的本地端口映射到公网。

#### 客户端
```bash
cd client/

# 安装依赖
npm install

# 运行脚本
node client.js
```

#### 服务端
```bash
cd server/
deno run --allow-net server.js
```

#### 测试
```bash
curl -v -x "http://127.0.0.1:3000/" http://www.baidu.com/
```

#### 各平台差异
 * 某平台的其中一位合作伙伴是中国某知名公司，不要在那个平台上测试
 * 某平台在 response 后会切断所有连接，需要调用 context.waitUntil() 保住连接
 * 某些套壳 AWS 的 serverless 平台速度感人
 * 域名的兼容性会比 IP 好一点

#### 叠甲
我水平不高，各位如果遇到问题，大概率我解决不了。  
上面写那么多字，其实就是可以在 netlify 部署 ws 代理的意思，但是这个 ws 和 xray-core 的有所不同。  
