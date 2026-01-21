# mezn-cbz

Mezn CBZ Reader
├── 核心阅读
│   ├── CBZ 流式解压
│   ├── 排序和预加载
│   └── 双指缩放、翻页自动复位
│
├── 交互导航
│   ├── 点击、滑动、键盘翻页
│   ├── 日漫、普通 LTR
│   ├── 进度记忆、跳转页面
│   └── 全屏 / 菜单自动隐藏
│
└── 检测目录
     ├── 自动检测下一卷
     └── 章节目录弹窗

##  info.json

```
{
  "title": "Rumic World Vol.1",
  "chapters": [
    { "title": "Chapter 1", "startPage": 1 },
    { "title": "Chapter 2", "startPage": 10 }
  ]
}
```

## 下一卷规则

`(_E)(\d+)(\.pdf)$`

```
https://xxx.xxx.com/?url=https://xxx.xxx.com/漫画名称_Vol_01.cbz
https://xxx.xxx.com/?url=https://xxx.xxx.com/漫画名称_Vol_02.cbz
```

## cloudflare pages

框架预设：`React (Vite)`

构建命令：`npm run build`

构建输出目录：`/dist`

环境变量（高级）：`NODE_VERSION` = `24`