---
title: "搜索"
slug: "search"
layout: "search"
# 站内搜索是纯前端实现：Hugo 构建时输出一份 JSON 索引，浏览器加载后本地匹配。
# 不依赖任何第三方搜索服务，所以零成本、无隐私问题。
outputs:
    - html
    - json
menu:
    main:
        weight: -60
        params:
            icon: search
---
