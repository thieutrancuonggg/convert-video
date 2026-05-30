# TikTok Affiliate Video Variation Tool

Phần mềm local bằng Node.js để tự động tạo **3 biến thể video TikTok Affiliate** từ một video gốc.
Mỗi biến thể có thay đổi nhẹ về zoom, màu sắc, tốc độ và hook text — giữ nguyên nội dung bán hàng, sản phẩm và người nói.

---

## Công nghệ sử dụng

| Lớp       | Package                                     |
|-----------|---------------------------------------------|
| Server    | Express, EJS, express-ejs-layouts           |
| Upload    | multer (diskStorage)                        |
| Video     | fluent-ffmpeg, ffmpeg-static, @ffprobe-installer/ffprobe |
| ZIP       | archiver (stream)                           |
| Utility   | fs-extra, uuid, compression, helmet, morgan |
| Dev       | nodemon, dotenv                             |

---

## Yêu cầu môi trường

- **Node.js** ≥ 18 (khuyến nghị 20 LTS)
- **FFmpeg** — được bundle tự động qua `ffmpeg-static` và `@ffprobe-installer/ffprobe`  
  _(không cần cài FFmpeg thủ công)_  
  > **macOS Apple Silicon (M1/M2/M3):** dùng `@ffprobe-installer/ffprobe` thay vì `ffprobe-static` vì `ffprobe-static@3.1.0` đóng gói nhầm binary x86_64 vào thư mục arm64

### macOS — quyền thực thi FFmpeg

Lần đầu chạy trên macOS, nếu bị lỗi `spawn EACCES`:

```bash
chmod +x node_modules/ffmpeg-static/ffmpeg
```

### Text hook (tiếng Việt)

Hook text tiếng Việt cần font Unicode. Tool tự tìm các font sau:

| OS      | Font thử theo thứ tự                                    |
|---------|--------------------------------------------------------|
| macOS   | `/Library/Fonts/Arial.ttf`, `/System/Library/Fonts/Supplemental/Arial.ttf` |
| Windows | `C:/Windows/Fonts/Arial.ttf`                           |
| Linux   | `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`      |

Nếu không tìm thấy font, text vẫn hiển thị nhưng dấu tiếng Việt có thể không đúng (dùng font built-in của FFmpeg).

---

## Cài đặt

```bash
cd video-affiliate-tool
npm install
```

Sao chép file env:

```bash
cp .env.example .env
```

---

## Chạy dev (có hot-reload)

```bash
npm run dev
```

## Chạy production

```bash
npm start
```

Mở trình duyệt: **http://localhost:3000**

---

## Dọn dẹp file cũ thủ công

```bash
npm run clean
```

_(Xóa toàn bộ nội dung trong `uploads/` và `outputs/`)_

---

## Cấu hình (.env)

| Biến                    | Mặc định | Mô tả                                    |
|-------------------------|----------|------------------------------------------|
| `PORT`                  | `3000`   | Port HTTP                                |
| `NODE_ENV`              | `development` | `development` / `production`        |
| `MAX_UPLOAD_SIZE_MB`    | `200`    | Giới hạn upload (MB)                     |
| `MAX_CONCURRENT_RENDERS`| `1`      | Số job render chạy đồng thời            |
| `CLEANUP_AFTER_HOURS`   | `24`     | Xóa file cũ hơn X giờ khi app khởi động |

---

## Cấu trúc thư mục

```
video-affiliate-tool/
├── uploads/               # File video gốc sau khi upload
├── outputs/               # Các biến thể đã render
├── public/
│   ├── css/style.css
│   └── js/app.js
├── views/
│   ├── layouts/main.ejs
│   ├── pages/             # index, processing, result, error
│   └── partials/          # header, footer
├── src/
│   ├── app.js             # Express app setup
│   ├── server.js          # Bootstrap + listen
│   ├── config/            # app, ffmpeg, storage
│   ├── constants/         # video limits, variant definitions
│   ├── controllers/       # video.controller.js
│   ├── routes/            # video.routes.js
│   ├── services/          # upload, video-analysis, ffmpeg, variant, zip, cleanup
│   ├── middlewares/       # upload, validate-video, error
│   ├── utils/             # file, path, logger, response
│   └── jobs/              # render-queue.js (in-memory)
├── .env.example
├── package.json
└── README.md
```

---

## Routes chính

| Method | Path                         | Mô tả                         |
|--------|------------------------------|-------------------------------|
| GET    | `/`                          | Trang upload                  |
| POST   | `/upload`                    | Upload + tạo job render       |
| GET    | `/processing/:jobId`         | Trang đang xử lý              |
| GET    | `/jobs/:jobId/status`        | JSON trạng thái job           |
| GET    | `/result/:jobId`             | Trang kết quả                 |
| GET    | `/preview/:jobId/:filename`  | Stream video inline (preview) |
| GET    | `/download/:jobId/zip`       | Tải ZIP tất cả biến thể       |
| GET    | `/download/:jobId/:filename` | Tải từng file video           |
| GET    | `/health`                    | Health check                  |

---

## 3 biến thể mặc định

| Biến thể       | Zoom  | Sáng  | Tương phản | Tốc độ | Hook text                        | Vị trí |
|----------------|-------|-------|------------|--------|----------------------------------|--------|
| V1 Light       | 1.03× | +0.03 | 1.03       | 1.00×  | "Xem trước khi bạn mua"          | Top    |
| V2 Medium      | 1.06× | +0.04 | 1.05       | 1.01×  | "Mình đã test thử sản phẩm này"  | Bottom |
| V3 Strong Safe | 1.08× | +0.02 | 1.08       | 0.99×  | "Có đáng mua không?"             | Top    |

**Giới hạn an toàn áp dụng cho tất cả biến thể:**
- Zoom tối đa 1.08× — không crop sâu vào vùng trung tâm
- Translate tối đa 30px — không che mặt / sản phẩm
- Hook text chỉ hiển thị 2 giây đầu, đặt ở safe zone với nền mờ
- Không stretch, không làm méo tỷ lệ

---

## Lưu ý khi dùng trên macOS / Windows

**macOS:**
- Nếu gặp lỗi "cannot be opened because the developer cannot be verified" với ffmpeg-static:  
  `xattr -d com.apple.quarantine node_modules/ffmpeg-static/ffmpeg`
- Font Vietnamese: cài Microsoft Office sẽ có Arial.ttf tại `/Library/Fonts/`

**Windows:**
- Dùng PowerShell hoặc Git Bash để chạy lệnh npm
- Font Arial thường có sẵn tại `C:/Windows/Fonts/Arial.ttf`
- Path dài có thể gây lỗi — nên đặt project tại thư mục ngắn (VD: `C:\projects\`)

---

## Giới hạn MVP hiện tại

- Job state lưu trong memory — restart server sẽ mất trạng thái job đang chạy
- Không có authentication (chỉ dùng local)
- Hook text cố định theo config trong `variant.constants.js`
- Không có real-time progress bar chính xác (polling mỗi 2 giây)
- Chỉ nhận file `.mp4`

---

## Hướng phát triển

- [ ] AI subtitle tự động (Whisper)
- [ ] AI voice-over thay thế
- [ ] Auto B-roll chèn giữa video
- [ ] Batch upload nhiều video
- [ ] Custom hook text nhập trực tiếp trên UI
- [ ] Tuỳ chỉnh số lượng biến thể
- [ ] Lưu job state vào SQLite để không mất khi restart
- [ ] Export preset biến thể theo ngành hàng
