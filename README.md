# Weekly Journal — 部署指南

## 项目结构

```
site/
├── public/                    ← 静态文件,部署根目录
│   ├── index.html             ← 登录门户(时区检测 + TOTP 输入)
│   ├── denied.html            ← 拒绝访问页(反向时钟)
│   └── journal/
│       ├── index.html         ← 主框架(侧栏 + iframe)
│       └── week1.html ~ week9.html
└── functions/                 ← Cloudflare Pages Functions(后端)
    ├── api/
    │   └── verify.js          ← TOTP 验证 + Cookie 签发
    └── journal/
        └── _middleware.js     ← 检查 Cookie,未登录就踢回首页
```

## 一、生成 TOTP 密钥(Seed)

TOTP 密钥是一串 **Base32 编码** 的字符串(只包含 A-Z 和 2-7)。推荐用以下任一方法生成:

### 方法 1:浏览器控制台(最快)

打开任何网页,按 F12 进开发者工具的 Console 标签,粘贴:

```js
const bytes = new Uint8Array(20);
crypto.getRandomValues(bytes);
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let bits = 0, value = 0, output = '';
for (const b of bytes) {
  value = (value << 8) | b;
  bits += 8;
  while (bits >= 5) {
    output += alphabet[(value >>> (bits - 5)) & 31];
    bits -= 5;
  }
}
console.log(output);
```

输出大概长这样:`JBSWY3DPEHPK3PXP4RVZN6HSAGAMVCWA`

**把这串字符串复制下来,这就是你的 TOTP 密钥。**

### 方法 2:用 Google Authenticator 之类的应用扫码

Google Authenticator / 微软 Authenticator / 1Password 都支持 TOTP。
访问 `https://stefansundin.github.io/2fa-qr/` 之类的工具,
生成一个 secret 并扫码加到 app 里。

## 二、用密钥生成你随身的"二维码 + 手机端"

你需要把这个 TOTP 密钥添加到你手机上的 Authenticator app:

1. 打开 Google Authenticator(或类似 app)
2. 添加账户 → 手动输入
3. 账户名:Journal
4. 密钥:粘贴上面那串字符串
5. 选择 "Time-based"

完成后,Authenticator 会每 30 秒生成一个 6 位数密码。
**这就是你课堂演示时给老师看的东西。**

## 三、二维码怎么做

你的二维码只需要编码 **你网站的 URL**,比如 `https://journal.yourdomain.com/`

去 https://www.qrcode-monkey.com/ 或任何二维码生成器,
输入你的域名,生成 PNG,打印出来即可。

(打印那张二维码 + 你手机上的 Authenticator app = 你的"动态钥匙")

## 四、部署到 Cloudflare Pages

### 1. 上传代码

最简单:把 `site/` 文件夹推到 GitHub,然后 Cloudflare Pages 连接 GitHub 仓库自动部署。

或者:Cloudflare Pages 后台 → Direct Upload → 拖拽整个 `site` 目录。

### 2. 构建设置

- **Framework preset**: None
- **Build command**: (留空)
- **Build output directory**: `public`
- **Root directory**: (留空,如果 site 是你的 git root 就这样)

### 3. 设置环境变量(关键)

部署完成后,进入 Pages 项目 → **Settings → Environment variables**:

| 变量名 | 值 | 说明 |
|---|---|---|
| `TOTP_SECRET` | `JBSWY3DPEHPK3PXP4RVZN6HSAGAMVCWA` | 你刚才生成的那串 |
| `SESSION_SECRET` | 另一串随机字符串(任意) | 给 cookie 签名用 |

**两个变量都要在 Production 环境下设置。**

设置完后,重新触发一次部署(让环境变量生效)。

### 4. 绑定你的域名

Pages 项目 → Custom domains → 添加你的域名。
Cloudflare 会自动给你配 DNS 和 HTTPS。

## 五、测试

1. 打开你的域名,应该看到登录页(深色,两个时钟)
2. 打开 Authenticator app,看当前 6 位数密码
3. 在网页里输入,点 Open
4. 应该跳转到 `/journal/`,看到侧栏 + 欢迎页
5. 点击侧栏的 Week 1-9 切换内容

### 测试拒绝访问

故意输错密码 → 应该跳转到 `/denied.html`,
看到 "Your time is not our time" + 反向时钟 + 6 秒后自动跳回登录页。

## 六、注意事项

- Cookie 有效期是 **6 小时**,过期需重新登录
- TOTP 验证容忍 ±30 秒时钟偏差(防止本地时间误差导致误拒)
- 时区不是 Melbourne 时**不会**拒绝,只是登录页会显示警告 (你选的"中等"模式)
- 想撤销访问 → Cloudflare 后台改 `SESSION_SECRET`,所有现有 cookie 立刻失效

## 七、未来扩展

- Week 10/11/12 内容写好后,在 `public/journal/` 添加 `week10.html` 等
- 然后修改 `journal/index.html` 第 173 行附近,把 disabled 属性删掉

## 八、本地预览(可选)

Cloudflare Functions 需要 wrangler 才能本地跑。若只想看页面效果(不测验证):

```bash
cd site/public
python3 -m http.server 8000
```

然后浏览器打开 http://localhost:8000/journal/index.html 直接看主框架(绕过登录)。

如果要本地测验证逻辑:

```bash
npm install -g wrangler
cd site
wrangler pages dev public --compatibility-date=2024-01-01
```

注意本地需要在 `.dev.vars` 文件里填 `TOTP_SECRET=...`
