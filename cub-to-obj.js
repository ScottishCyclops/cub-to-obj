/**
 * Tool version
 */
const version = `0.0.1`

const fs = require('fs')
const path = require('path')

/**
 * Precision to use when saving to OBJ and MTL files
 */
const precision = 6

/**
 * The faces that make up a cube assuming the first vertex is 1
 */
const defaultCubeFaces = [
  [1, 2, 4, 3],
  [3, 4, 8, 7],
  [7, 8, 6, 5],
  [5, 6, 2, 1],
  [3, 7, 5, 1],
  [8, 4, 2, 6],
]

/**
 * Chunk a buffer into smaller buffers
 * @param {Buffer} buffer the input buffer
 * @param {number} chunkSize the maximum size of a chunk
 * @returns {Buffer[]} the chunks
 */
function chunkBuffer(buffer, chunkSize) {
  const out = []
  const len = buffer.length

  for (let i = 0; i < len; i += chunkSize) {
    out.push(buffer.slice(i, i + chunkSize))
  }

  return out
}

/**
 * Generate a material name
 * @param {number} index the index of the material
 * @param {string} name the name of the file
 * @returns {string} the material name
 */
function matName(index, name) {
  return `${name}-mat-${index}`
}

/**
 * Generate a valid MTL string from the given colors
 * @param {Buffer[]} colors the colors to turn into materials
 * @param {string} name the name of the file
 * @returns {string} the MTL string
 */
function generateMTL(colors, name) {
  // make all colors 0-1 instead of 0-255, and fix the precision
  const zeroToOne = colors.map(color =>
    Array.from(color).map(x => (x === 0 ? 0 : x / 255).toFixed(precision))
  )

  // build the output string
  // see https://en.wikipedia.org/wiki/Wavefront_.obj_file#Basic_materials
  return (
    `# CUB to OBJ v${version}\n` +
    zeroToOne
      .map((material, i) => {
        return `newmtl ${matName(i, name)}\n` + `Kd ${material.join(' ')}\n`
      })
      .join('\n')
  )
}

/**
 * Add a value to the x component of a 3d point
 * @param {[number, number, number]} point a 3d point
 * @param {number} x the value to add to x
 * @returns {[number, number, number]} a new point
 */
function addX(point, x) {
  return [point[0] + x, point[1], point[2]]
}

/**
 * Add a value to the y component of a 3d point
 * @param {[number, number, number]} point a 3d point
 * @param {number} y the value to add to y
 * @returns {[number, number, number]} a new point
 */
function addY(point, y) {
  return [point[0], point[1] + y, point[2]]
}

/**
 * Add a value to the z component of a 3d point
 * @param {[number, number, number]} point a 3d point
 * @param {number} z the value to add to z
 * @returns {[number, number, number]} a new point
 */
function addZ(point, z) {
  return [point[0], point[1], point[2] + z]
}

/**
 * Turn a point in space into the vertices and faces that make up a cube at that point
 * @param {[number, number, number]} point the point in space
 * @param {number} faceOffset the offset to apply to the faces indices
 * @returns {{vertices: [number, number, number][], faces: [number, number, number, number][]}} the vertices and faces
 */
function pointToCube(point, faceOffset) {
  // all 8 points that make up a cube
  const vertices = [
    point,
    addX(point, 1),
    addY(point, 1),
    addY(addX(point, 1), 1),

    addZ(point, 1),
    addZ(addX(point, 1), 1),
    addZ(addY(point, 1), 1),
    addZ(addY(addX(point, 1), 1), 1),
  ]

  // real offset is the number of vertices times the face offset
  const offset = faceOffset * vertices.length

  const faces = defaultCubeFaces.map(face => face.map(value => value + offset))

  return {
    vertices,
    faces,
  }
}

/**
 * Turn a 3d index into a 1d index
 * @param {number} x the x index on the width
 * @param {number} y the y index on the depth
 * @param {number} z the z index on the height
 * @param {number} width the total width
 * @param {number} depth the total depth
 * @param {number} height the total height
 * @returns {number} a 1d index
 */
function xyzToIndex(x, y, z, width, depth, height) {
  return x + width * (y + depth * z)
}

/**
 * Generate a valid OBJ string from the given data
 * @param {number} width the width of the CUB object
 * @param {number} depth the depth of the CUB object
 * @param {number} height the height of the CUB object
 * @param {number[]} colorIndicies an index map of each
 * @param {string} name the name of the file
 * @returns {string} the OBJ string
 */
function generateOBJ(width, depth, height, colorIndicies, name) {
  /**
   * The points filtered by color
   * @type {{[x: string]: {colorIndex: number, points: [number, number, number][]}}}
   */
  const byColor = {}

  // loop over all 3d points
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < depth; y++) {
      for (let z = 0; z < height; z++) {
        // isolate the points based on their color, to then generate an OBJ object per color
        const color = colorIndicies[xyzToIndex(x, y, z, width, depth, height)]

        // ingore transparent cubes
        if (color === -1) {
          continue
        }

        if (byColor[color] === undefined) {
          byColor[color] = { colorIndex: color, points: [] }
        }

        byColor[color].points.push([x, y, z])
      }
    }
  }

  /**
   * Increase the index globaly for the OBJ file
   */
  let cubeIndex = 0

  const objects = Object.values(byColor).map(({ colorIndex, points }) => {
    const cubes = points.map((point, i) => pointToCube(point, cubeIndex++))

    // gather all vertices and all faces into the same arrays
    // to output them to the same object

    /**
     * @type {number[][]}
     */
    const allVertices = [].concat(...cubes.map(cube => cube.vertices))

    /**
     * @type {number[][]}
     */
    const allFaces = [].concat(...cubes.map(cube => cube.faces))

    // build the OBJ string for a single object
    // see https://en.wikipedia.org/wiki/Wavefront_.obj_file and more specificly,
    // see https://en.wikipedia.org/wiki/Wavefront_.obj_file#Referencing_materials
    return (
      `o ${name}-obj-${colorIndex}\n` +
      allVertices.map(vertex => `v ${vertex.join(' ')}\n`).join('') +
      `usemtl ${matName(colorIndex, name)}\n` +
      `s off\n` +
      allFaces.map(face => `f ${face.join(' ')}\n`).join('')
    )
  })

  // build the final OBJ string
  return (
    `# CUB to OBJ v${version}\n` + `mtllib ${name}.mtl\n` + objects.join('\n')
  )
}

/**
 * Isolate unique colors and get an list of references to that array
 * @param {Buffer[]} inputColors all the colors as they appear in the CUB file
 * @returns {{uniqueColors: Buffer[], colorIndicies: number[]}} the isolated colors
 */
function isolateColors(inputColors) {
  const uniqueColors = {}
  const colorIndicies = []

  const blackKey = '000000'
  let index = 0

  inputColors.forEach((color, i) => {
    const key = color.toString('hex')

    // detect the black color (transparent). don't include it in the unique colors
    // and replace the index with a -1 so we can easily not write it to the OBJ too
    if (key === blackKey) {
      colorIndicies[i] = -1
      return
    }

    const existingColor = uniqueColors[key]

    if (existingColor === undefined) {
      uniqueColors[key] = { color, index }
      colorIndicies[i] = index
      index++
    } else {
      colorIndicies[i] = existingColor.index
    }
  })

  return {
    uniqueColors: Object.values(uniqueColors).map(value => value.color),
    colorIndicies,
  }
}

/**
 * Convert the binary data of a CUB file to a OBJ string and an MTL string
 * @param {Buffer} data the CUB binary data
 * @param {string} name the name of the file
 * @returns {{obj: string, mtl: string}} the OBJ and MTL strings
 */
function convertCub(data, name) {
  // the first 12 bytes of the file are the width, depth and height of the object
  // stored as unsigned 32 bit integer little endian
  const width = data.readUInt32LE(0)
  const depth = data.readUInt32LE(4)
  const height = data.readUInt32LE(8)

  // after that, all the colors are stored as a "3d" array of RGB (3 bytes)
  const colors = chunkBuffer(data.slice(12), 3)

  const { colorIndicies, uniqueColors } = isolateColors(colors)
  const obj = generateOBJ(width, depth, height, colorIndicies, name)
  const mtl = generateMTL(uniqueColors, name)

  return {
    obj,
    mtl,
  }
}

/**
 * Run the entry points of the program
 * @returns {void} nothing
 */
function main() {
  /**
   * The input file given by the user
   */
  const file = process.argv[2]

  if (file === '-h' || file === '--help') {
    // the user wants to see the help infos
    printHelp()
  }

  if (!file) {
    console.error('No file provided')
    printHelp()
    process.exit(1)
  }

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    console.error('The povided file is invalid')
    process.exit(1)
  }

  /**
   * The output folder potentially given by the user
   */
  const outFolder = process.argv[3] || path.dirname(file)

  if (!fs.existsSync(outFolder) || !fs.statSync(outFolder).isDirectory()) {
    console.error('The povided output directory is invalid')
    process.exit(1)
  }

  console.log(`Output folder is ${path.resolve(outFolder)}`)

  // read as binary
  const content = fs.readFileSync(file)

  // get the name of the file without path or extension
  const name = path.basename(file, path.extname(file))

  const { obj, mtl } = convertCub(content, name)

  const outOBJ = path.join(outFolder, `${name}.obj`)
  const outMTL = path.join(outFolder, `${name}.mtl`)

  fs.writeFileSync(outOBJ, obj, 'utf-8')
  fs.writeFileSync(outMTL, mtl, 'utf-8')

  console.log('Done!')
}

function printHelp() {
  console.log(
    `Usage: node ${path.basename(
      process.argv[1]
    )} <input-file> <output-folder?>`
  )
  console.log()
  console.log(`  <input-file> the .cub file to process`)
  console.log(
    `  <output-folder?> the optional output folder where to write the .obj and .mtl files`
  )
  console.log(
    `  if not given, the files will be written to the directory of the .cub file`
  )
}

main()
