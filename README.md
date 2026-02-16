# Vong Quay Li Xi Tet 2026

Web ReactJS giao dien Tet 2026 + backend Node.js de gui email ket qua khi nguoi choi quay du 3 luot.

## Chuc nang chinh

- Vong quay menh gia tu `10k` den `150k`, menh gia cao co xac suat thap hon.
- Popup nhap ten nguoi choi bang SweetAlert2.
- Moi nguoi choi toi da `3` luot quay.
- Luu du lieu nguoi choi + lich su quay vao localStorage.
- Hieu ung confetti, am thanh, bang vang xep hang.
- Tu dong gui email ket qua khi nguoi choi vua hoan tat luot quay thu 3.

## Cai dat

```bash
npm install
```

## Cau hinh email

Du an doc bien moi truong tu file `.env` (xem mau tai `.env.example`).

Bat buoc:

- `MAIL_USER`: Gmail gui mail
- `MAIL_APP_PASSWORD`: app password Gmail
- `MAIL_TO`: email nhan ket qua
- `VITE_API_BASE_URL`: URL backend mail API

## Chay local

```bash
npm run dev
```

Lenh nay chay dong thoi:

- frontend Vite: `http://localhost:5173`
- backend mail API: `http://localhost:8787`

## Build frontend

```bash
npm run build
```

## Test API backend nhanh

```bash
curl http://localhost:8787/api/health
```
