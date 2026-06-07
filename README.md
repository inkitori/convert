# Convert

A small, private file converter that runs entirely in the browser. It supports
common image, audio, and video formats without uploading files to a server.

## Development

```bash
npm install
npm run dev
```

The FFmpeg WebAssembly core is copied from the pinned npm package into the
untracked `public/ffmpeg/` directory before development and production builds.

## Checks

```bash
npm test
npm run build
```

The Vite production base is `/convert/` for deployment at
`https://inkitori.github.io/convert/`.

## Browser support

Current desktop Chrome, Edge, Firefox, and Safari are supported. Mobile
browsers are best-effort. Media conversion uses the single-thread FFmpeg core,
so large video files can be slow and memory-intensive.

## License

Application code is MIT licensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
for bundled dependency information.
