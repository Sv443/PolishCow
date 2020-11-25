// takes raw jpg frames from ezgif.com and renames them to use the format "frame_nbr.jpg"

const fs = require("fs-extra");
const { resolve, join } = require("path");

const dirName = resolve("./frames");
const outputDirName = resolve("./frames-renamed");


if(!fs.existsSync(outputDirName))
    fs.mkdirSync(outputDirName);

let filePaths = fs.readdirSync(dirName);

filePaths.forEach((filePath, i) => {
    let index = parseInt(filePath.substr(6, 2));

    if(isNaN(index) || index < 0)
        throw new Error(`File at path "${join(dirName, filePath)}" doesn't match ezgif.com naming scheme`);

    fs.renameSync(join(dirName, filePath), join(outputDirName, `${index}.jpg`));

    console.log(`Processed ${(i + 1)} of ${filePaths.length}`);
});

console.log("Done.");