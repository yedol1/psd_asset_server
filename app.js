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
const fs = require("fs").promises;

const app = express();

// Nunjucks 설정
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "njk");
nunjucks.configure("views", { express: app, watch: true });

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || "images";
    cb(null, path.join("uploads", folder));
  },
  filename: (req, file, cb) => {
    const originalName = path.basename(file.originalname, path.extname(file.originalname));
    const extension = path.extname(file.originalname);
    cb(null, `${originalName}-${Date.now()}${extension}`);
  },
});
const upload = multer({ storage: storage });

// 미들웨어 설정
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use("/", require("./routes/index"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 로그인 페이지는 누구나 접근 가능하게 설정
app.get("/admin-login", (req, res) => {
  res.render("index");
});

// 로그인 처리
app.post("/admin-login", (req, res) => {
  const adminPassword = "ketotop0014";
  if (req.body.password === adminPassword) {
    req.session.isAuthenticated = true;
    res.redirect("/main"); // 로그인 성공 시 /main으로 리디렉션
  } else {
    res.send("Incorrect password.");
  }
});

// 로그인이 되어 있지 않으면 접근 불가능한 경로들
app.get("/main", ensureAdmin, (req, res) => {
  res.render("main");
});

app.post("/upload", ensureAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");
  res.render("fileInfo", { file: req.file });
});

app.delete("/delete-image/:filename", ensureAdmin, async (req, res, next) => {
  try {
    const filename = req.params.filename;
    await fs.unlink(path.join(__dirname, "uploads", filename));
    res.send({ success: true, message: "File deleted." });
  } catch (err) {
    next(err);
  }
});

app.post("/rename-image", ensureAdmin, async (req, res, next) => {
  try {
    const { oldName, newName } = req.body;
    await fs.rename(path.join(__dirname, "uploads", oldName), path.join(__dirname, "uploads", newName));
    res.send({ success: true, message: "File renamed." });
  } catch (err) {
    next(err);
  }
});

app.get("/uploaded-images", ensureAdmin, async (req, res, next) => {
  try {
    let files = await getUploadedFiles();
    res.render("uploadedImages", { files: files });
  } catch (err) {
    next(err);
  }
});

// 404 및 오류 핸들러
app.use((req, res, next) => next(createError(404)));

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
