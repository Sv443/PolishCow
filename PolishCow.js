const { resolve } = require("path");
const sound = require("sound-play");
const mm = require("music-metadata");
const fs = require("fs-extra");
const scl = require("svcorelib");
const asciify = require("asciify-image");

const packageJson = require("./package.json");

const col = scl.colors.fg;

const cursor = require("ansi")(process.stdout);


/**
 * All pre-calculated frames are saved to this object
 * @prop {String[][][]} [0x0] Example
 */
var frameSets = {};


/** Settings for Polish Cow */
const settings = {
    /** Set to true to enable debug messages */
    dbg: false,
    /** Path to the sound file */
    soundFile: resolve("./resources/polishcow.mp3"),
    /** Adds this amount of seconds to the played audio file since the sound-play package is pretty inaccurate */
    endBuffer: 0.4,
    /** Where the frames of the animation are located */
    animationDirectory: resolve("./resources/animation/"),
    /** Minimum aspect ratio the terminal window needs to be in size */
    minAspectRatio: 2.5,
    /** Interval (in seconds) between the single frames of the animation */
    animationInterval: 0.2,
    /** In which sequence to play the animations */
    animationSequence: [ 0, 1, 0, 1, 2, 3, 4, 5, 4, 5, 3, 2 ],
    /** [ Width, Height ] - By what number to decrease height or width by, globally */
    animationPadding: [ 0, 0 ],
    /** Options for the package asciify-image - Documentation: https://www.npmjs.com/package/asciify-image#optionscolor */
    asciifyOpts: {
        color: true,
        fit: "box",
        format: "array"
    }
};

/** @type {Boolean} Set to true to pause the animation */
var animationPaused = false;

/** Current sequence index of the animation */
var currentAnimSequenceIdx = 0;



/**
 * Runs the "program"
 */
async function PolishCow()
{
    if(!process.stdout.isTTY)
    {
        console.log(`\n${col.red}Standard output channel is not a TTY (terminal)${col.rst}\n\n(Process exits automatically)\n`);

        setTimeout(() => process.exit(1), 10000);
    }
    else
    {
        if(!fs.existsSync(settings.soundFile))
        {
            console.log(`\n${col.red}Sound file at path "${settings.soundFile}" doesn't exist.${col.rst}\n\n(Process exits automatically)\n`);
            
            setTimeout(() => process.exit(1), 10000);
        }
        else
        {
            cursor.hide();

            updateWindowTitle();
            // play sound file
            play(settings.soundFile, true);
            
            let calcDelta = new Date().getTime();
            // calculate first frame set
            calculateCurrentFrameSet().then(() => {
                if(settings.dbg)
                    console.log(`Calculating first frame set (${process.stdout.columns}x${process.stdout.rows}) took ${(new Date().getTime() - calcDelta)}ms`);

                // start animation loop after first frame set was calculated
                startAnimation();

                // check if aspect ratio is ok
                checkAspectRatio();
            });

            process.stdout.on("resize", () => {
                // after the terminal window is resized, this code will run:
                if(settings.dbg)
                    console.log("RESIZE EVENT TRIGGERED");

                updateWindowTitle();

                // check aspect ratio to ensure it is still okay
                checkAspectRatio();

                // make sure cursor is hidden
                cursor.hide();
                let resizeCalcDelta = new Date().getTime();
                // calculate frame set so the next animation tick can grab it
                calculateCurrentFrameSet().then(() => {
                    if(settings.dbg)
                        console.log(`Calculating current frame set (${process.stdout.columns}x${process.stdout.rows}) took ${(new Date().getTime() - resizeCalcDelta)}ms`);
                });
            });
        }
    }
}

/**
 * Checks the aspect ratio of the terminal window, pausing the animation if it is out of bounds
 */
function checkAspectRatio()
{
    let aspectRatio = (process.stdout.columns / process.stdout.rows);

    if(aspectRatio < settings.minAspectRatio)
    {
        animationPaused = true;

        console.clear();
        console.log(`\n${col.red}Window aspect ratio is too small.\nPlease make the window wider!${col.rst}\n\nExpected aspect ratio: ${settings.minAspectRatio}  : 1\nCurrent aspect ratio:  ${aspectRatio.toFixed(2)} : 1\n\n`);
    }
    else if(animationPaused)
        animationPaused = false;
}

/**
 * Starts the animation
 */
function startAnimation()
{
    console.clear();

    const displayFrame = idx => {
        /** [ Width, Height ] */
        let windowSize = [ process.stdout.columns, process.stdout.rows ];
        let frameSetName = `${windowSize[0]}x${windowSize[1]}`;

        if(!frameSets[frameSetName])
            return false;

        // convert frame set with current resolution at specified index to string
        let frameText = frameSets[frameSetName][idx].map(row => row.join("")).join("\n");

        console.clear();
        if(settings.dbg)
            console.log(`Displaying frame #${idx} (Sequence: ${settings.animationSequence.join(" ")})\n`);

        console.log(frameText);
        return true;
    };


    setInterval(() => {
        if(!animationPaused)
        {
            // if animation not paused, increment through animation sequence, calling displayFrame() on each frame
            if(displayFrame(settings.animationSequence[currentAnimSequenceIdx]))
                currentAnimSequenceIdx++;

            if(currentAnimSequenceIdx >= settings.animationSequence.length)
                currentAnimSequenceIdx = 0;
        }
    }, settings.animationInterval * 1000);
}

/**
 * Uses parallelized operations to calculate the frame set of the current window resolution and modifies the `frameSets` variable accordingly
 * @returns {Promise} Resolves once all frames of the current frame set have been calculated
 */
function calculateCurrentFrameSet()
{
    return new Promise((pRes, pRej) => {
        /** [ Width, Height ] */
        const windowSize = [ process.stdout.columns, process.stdout.rows ];
        const frameSetName = `${windowSize[0]}x${windowSize[1]}`;
        const framePaths = getAllAnimationFrames();

        if(typeof frameSets[frameSetName] == "undefined")
        {
            let promises = [];

            // iterate over all frame's file paths
            framePaths.forEach(path => {
                promises.push(new Promise((framePRes, framePRej) => {
                    // convert image to ASCII art
                    imageToResponsiveAscii(path)
                    .then(res => {
                        return framePRes(res);
                    })
                    .catch(err => {
                        return framePRej(err);
                    });
                }));
            });


            // Parallelized way to calculate all frames of the current frame set (should theoretically speed things up)
            Promise.all(promises)
            .then(results => {
                frameSets[frameSetName] = results;

                return pRes();
            })
            .catch(err => {
                console.log(`\n${col.red}Error while reading animation frames: ${err}${col.rst}\n\n(Process exits automatically)\n`);

                setTimeout(() => process.exit(1), 10000);

                return pRej();
            });
        }
    });
}

/**
 * Returns all animation frame file paths
 * @returns {String[]} Returns an array of absolute file paths to the animation frames
 */
function getAllAnimationFrames()
{
    if(!fs.existsSync(settings.animationDirectory))
    {
        console.log(`\n${col.red}Couldn't find directory "${settings.animationDirectory}"${col.rst}\n\n(Process exits automatically)\n`);

        setTimeout(() => process.exit(1), 10000);

        return [];
    }
    else
    {
        let paths = [];

        // read through animation directory
        fs.readdirSync(settings.animationDirectory).sort().forEach(file => {
            let path = resolve(settings.animationDirectory, file);

            // make sure file is a JPG, PNG, GIF, BMP or TIFF
            if(path.match(/\.(png|jpe?g|gif|bmp|tiff)$/i))
            {
                // make sure file name consists of numbers only
                if(file.match(/^.?\/?[0-9]+\.\w+/i))
                    paths.push(path);
            }
        });

        return paths;
    }
}

/**
 * Updates the window title, reading dynamic values and shit like that
 */
function updateWindowTitle()
{
    return setWindowTitle(`Polish Cow - ${packageJson.author.name} [${process.stdout.columns}x${process.stdout.rows}]`);
}

/**
 * Plays a sound file (supports MP3, WAV and other formats)
 * @param {String} fPath File path to the sound file
 * @param {Boolean} [loop=false] Whether to loop the sound infinitely
 * @returns {Promise} Resolves promise once the sound finishes playing
 */
function play(fPath, loop)
{
    if(typeof loop != "boolean")
        loop = false;

    return new Promise((pRes) => {
        fPath = resolve(fPath);

        const playSoundFile = (meta, fPath) => {
            // get sound length to know when the sound has finished playing
            let soundLength = parseFloat(meta.format.duration.toFixed(3));

            // actually play the sound file
            sound.play(fPath);

            setTimeout(() => {
                // this gets called after the sound has finished playing
                // if the sound is set to loop, resolve the promise. If it isn't, infinitely play the sound after it has finished
                if(!loop)
                    return pRes();
                else
                    playSoundFile(meta, fPath);
            }, (soundLength + settings.endBuffer) * 1000);
        }

        // parse sound file to find out approximate duration
        mm.parseFile(fPath, {
            duration: true
        }).then(meta => {
            playSoundFile(meta, fPath);
        });
    });
}

/**
 * Sets the CLI window's title (supports Windows and *nix)  
 * Stolen from my other project - Townly
 * @param {String} title
 */
function setWindowTitle(title)
{
    // make sure title is a string
    if(typeof title.toString == "function")
        title = title.toString();

    // if on any OS other than Windows, use OSC sequence to set the window title, on Windows just assign title to `process.title`
    if(process.platform != "win32")
        process.stdout.write(`\x1b]2;${title}\x1b\x5c`); // *nix doesn't have a nice way to set the window title but this escape sequence should be able to do it (for reference search "OSC control sequences" on this page: https://man7.org/linux/man-pages/man4/console_codes.4.html)
    else
        process.title = title; // This should work only on Windows
}

/**
 * Converts an image at the provided path to ASCII art with dimensions being determined by terminal size
 * @param {String} imgSrc Path to the image
 * @returns {Promise[String[]]} Resolves with a 2D array of strings or rejects with an error message
 */
function imageToResponsiveAscii(imgSrc)
{
    return new Promise((pRes, pRej) => {
        imgSrc = resolve(imgSrc);

        // copies the values of `settings.asciifyOpts`, while losing reference and constant-ness
        let asciifySettings = scl.reserialize(settings.asciifyOpts);

        asciifySettings.width = (process.stdout.columns - settings.animationPadding[0]);
        asciifySettings.height = (process.stdout.rows - settings.animationPadding[1]);

        // convert image file to ASCII text
        asciify(imgSrc, asciifySettings)
        .then(res => {
            return pRes(res);
        })
        .catch(err => {
            return pRej(err);
        });
    });
}



// run this waste of my time
PolishCow();