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

const app = express();

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

const uploadImage = multer({ storage: imageStorage });
const uploadIcon = multer({ storage: iconStorage });

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

app.post("/upload/images", ensureAdmin, uploadImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).send("No image uploaded.");
  res.render("fileInfo", { file: req.file });
});

app.post("/upload/icons", ensureAdmin, uploadIcon.single("icon"), (req, res) => {
  if (!req.file) return res.status(400).send("No icon uploaded.");
  res.render("fileInfo", { file: req.file });
});

app.delete("/delete-image/:folder/:filename", ensureAdmin, async (req, res, next) => {
  try {
    const { folder, filename } = req.params;
    await fs.unlink(path.join(__dirname, "uploads", folder, filename));
    res.send({ success: true, message: "File deleted." });
  } catch (err) {
    next(err);
  }
});

app.post("/rename-image", ensureAdmin, async (req, res, next) => {
  try {
    const { oldName, newName, folder } = req.body;
    await fs.rename(path.join(__dirname, "uploads", folder, oldName), path.join(__dirname, "uploads", folder, newName));
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

app.use((req, res, next) => next(createError(404)));

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
