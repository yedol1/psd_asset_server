const path = require("path");
const fs = require("fs").promises;

async function getUploadedFiles() {
  const rootDir = path.join(__dirname, "..", "uploads");
  const folders = ["images", "icons"];
  let allFiles = [];

  for (let folder of folders) {
    const filesDir = path.join(rootDir, folder);
    let files = await fs.readdir(filesDir);
    allFiles = allFiles.concat(
      files.map((file) => ({
        name: file,
        folder: folder,
        path: path.join(filesDir, file),
        url: `/uploads/${folder}/${file}`,
      }))
    );
  }
  return allFiles;
}

module.exports = {
  getUploadedFiles,
};
