require("dotenv").config();
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const nunjucks = require("nunjucks");
const multer = require("multer");
const session = require("express-session");
const { ensureAdmin } = require("./middlewares/auth");
const { getUploadedFiles } = require("./helpers/upload");
const fs = require("fs");
const archiver = require("archiver");
const cors = require("cors");

const app = express();

const imageFilter = (req, file, cb) => {
  // 허용하는 이미지 MIME 타입
  const allowedMimes = ["image/jpeg", "image/pjpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml", "image/webp", "image/tiff", "image/bmp", "image/x-icon"];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only image files are allowed."), false);
  }
};

// Nunjucks 설정
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "njk");
nunjucks.configure("views", { express: app, watch: true });

// Multer 설정
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = path.join(__dirname, "uploads", "images");
    if (!fs.existsSync(destinationPath)) {
      fs.mkdirSync(destinationPath, { recursive: true });
    }
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    const originalName = path.basename(file.originalname, path.extname(file.originalname));
    const extension = path.extname(file.originalname);
    const fullPath = path.join(__dirname, "uploads", "images", `${originalName}${extension}`);

    if (fs.existsSync(fullPath)) {
      return cb(new Error("File with the same name already exists!"));
    }

    cb(null, `${originalName}${extension}`);
  },
});

const iconStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = path.join(__dirname, "uploads", "icons");
    if (!fs.existsSync(destinationPath)) {
      fs.mkdirSync(destinationPath, { recursive: true });
    }
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    const originalName = path.basename(file.originalname, path.extname(file.originalname));
    const extension = path.extname(file.originalname);
    const fullPath = path.join(__dirname, "uploads", "icons", `${originalName}${extension}`);

    if (fs.existsSync(fullPath)) {
      return cb(new Error("File with the same name already exists!"));
    }

    cb(null, `${originalName}${extension}`);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
});

const uploadIcon = multer({
  storage: iconStorage,
  fileFilter: imageFilter,
});

// 미들웨어 설정
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use("/", require("./routes/index"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 관리자 로그인
app.get("/admin-login", (req, res) => {
  res.render("index");
});

app.post("/admin-login", (req, res) => {
  const adminPassword = "ketotop0014";
  if (req.body.password === adminPassword) {
    req.session.isAuthenticated = true;
    res.redirect("/main");
  } else {
    res.send("Incorrect password.");
  }
});

app.get("/main", ensureAdmin, (req, res) => {
  res.render("main");
});

// 이미지 업로드
app.post(
  "/upload/images",
  ensureAdmin,
  uploadImage.array("images", 100),
  (req, res) => {
    if (!req.files) return res.status(400).send("No images uploaded.");
    res.render("fileInfo", { files: req.files });
  },
  (error, req, res, next) => {
    res.status(400).send(error.message);
  }
);

app.post(
  "/upload/icons",
  ensureAdmin,
  uploadIcon.array("icons", 100),
  (req, res) => {
    if (!req.files) return res.status(400).send("No icons uploaded.");
    res.render("fileInfo", { files: req.files });
  },
  (error, req, res, next) => {
    res.status(400).send(error.message);
  }
);

// 이미지 삭제
app.delete("/delete-image/:folder/:filename", ensureAdmin, async (req, res, next) => {
  try {
    const { folder, filename } = req.params;
    await fs.promises.unlink(path.join(__dirname, "uploads", folder, filename));
    res.send({ success: true, message: "File deleted." });
  } catch (err) {
    next(err);
  }
});

// 이미지 이름 변경
app.post("/rename-image", ensureAdmin, async (req, res, next) => {
  try {
    const { folder, oldName, newName } = req.body;

    const ext = path.extname(oldName); // 확장자명 추출
    const completeNewName = newName + ext; // 새 이름에 확장자명 추가

    await fs.promises.rename(path.join(__dirname, "uploads", folder, oldName), path.join(__dirname, "uploads", folder, completeNewName));

    res.send({ success: true, message: "File renamed." });
  } catch (err) {
    next(err);
  }
});

// 이미지 목록
app.get("/uploaded-images", ensureAdmin, async (req, res, next) => {
  try {
    let files = await getUploadedFiles();
    res.render("uploadedImages", { files: files });
  } catch (err) {
    next(err);
  }
});

// 이미지 다운로드
app.get("/download-uploads", ensureAdmin, (req, res, next) => {
  const archive = archiver("zip", {
    zlib: { level: 9 }, // 압축 수준 설정
  });

  const output = res;
  output.attachment("uploads.zip"); // 브라우저에서 다운로드할 파일 이름 설정

  archive.pipe(output);

  archive.directory(path.join(__dirname, "uploads"), false);

  archive.finalize();

  archive.on("error", (err) => {
    next(err);
  });
});

app.use((req, res, next) => next(createError(404)));

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
