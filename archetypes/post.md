---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
# 副标题/摘要，显示在首页卡片上。留空则自动截取正文开头
description: ""
date: {{ .Date }}
# 封面图：把图片放到本文同目录，这里写文件名即可（如 cover.jpg）
image: ""
# 分类只填一个（Stack 主题的卡片按分类着色）
categories:
    - 日常
# 标签可多个
tags:
    - 
# draft: true 时不会发布，写完改成 false 或直接删掉这行
draft: true
---

在这儿开始写。
