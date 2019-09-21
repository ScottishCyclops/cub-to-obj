# CUB to OBJ exporter

![Example in Blender 2.8](/blender-example.png)

This is a small script that takes in a .cub file from the game **Cube World** and turns it into a .obj and .mtl file

The goal is to be able to import Cube World data into any 3D Program, such as [Blender](https://blender.org).

It creates an OBJ object per material (color). But every cube is exported. That means you can remove/add cubes easily, or merge the overlapping vertices to keep only the minimum amount of data.

## Usage

You will need Node.JS to run the script. You can get it at https://nodejs.org/en/ for any platform.

No other dependancy is required. You can then download the .js file from Github, and run it with:

```bash
node cub-to-obj.js /your/cub-file.cub
```

You can also run:

```bash
node cub-to-obj.js --help
```

for a bit more info about the two available parameters.

## Orientation

To get the correct orientation, in Blender, I had to import using the following settings:

- Y Forward
- Z Up

I hope you like it. If you see any other necessary features, please get in touch.

Big thanks to _Chrismiuchiz_ on the [Cube World Discord](https://discord.gg/cubeworld) for helping me understand the .cub file format.
