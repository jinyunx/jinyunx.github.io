---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
# URL 短名，最终地址是 /p/<slug>/
# 建议填英文小写+连字符，方便分享；留空则用文件夹名
slug: "{{ .File.ContentBaseName }}"
date: {{ .Date }}
# 封面图：把图片放到本文同目录，这里写文件名即可（如 cover.jpg）
image: ""
# 加一行 encrypt: true 则正文加密，访客输密码才能看
# draft: true 时不会发布，写完改成 false 或直接删掉这行
draft: true
---

在这儿开始写。
