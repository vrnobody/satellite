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

#### 叠甲
我水平不高，各位如果遇到问题，大概率我解决不了。
