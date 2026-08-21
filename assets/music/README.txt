把背景音乐文件放到这个目录，例如 bgm.mp3

然后在 config/_default/params.yaml 里改两处：

    music:
      enable: true            # 改成 true
      file: "music/bgm.mp3"   # 改成你的实际文件名

格式建议 mp3（兼容性最好，全部浏览器支持）。
m4a / ogg 也可以，但 Safari 不支持 ogg。

体积注意：GitHub 仓库单文件建议不超过 50MB。
背景音乐用 128kbps 的 mp3 就够了，一首歌约 3~4MB。
纯环境音（雨声、白噪音）可以压到 96kbps，做成 1~2 分钟的无缝循环片段，
播放器已设 loop，会自动接续。

版权提醒：公开站点上放有版权的音乐存在风险，
推荐用 CC0 / 免版权素材，比如：
  - https://freesound.org      （环境音、白噪音，注意看每个文件的许可证）
  - https://incompetech.com    （Kevin MacLeod 的配乐，署名即可用）
  - https://pixabay.com/music/ （免费可商用）
