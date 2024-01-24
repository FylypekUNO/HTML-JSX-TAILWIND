import HtmlMinifier from '@minify-html/node';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { transform as minify_CSS } from '@parcel/css';
import babel from '@babel/core';
import * as fs from 'fs/promises';
import { existsSync as fs_existsSync } from 'fs';

const postcssInstance = postcss([tailwindcss, autoprefixer]);
const babelOptions = {
  presets: [
    [
      '@babel/preset-react',
      {
        pragma: '___CreateElement___',
      },
    ],
  ],
};

async function listFilesAndDirectoriesRecursively(
  initialPath,
  additionalPath = ''
) {
  console.log();
  const entries = await fs.readdir(initialPath + additionalPath, {
    withFileTypes: true,
  });

  const filePaths = [];
  const directoryPaths = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const { filePaths: childFilePaths, directoryPaths: childDirectoryPaths } =
        await listFilesAndDirectoriesRecursively(
          initialPath,
          `${additionalPath}/${entry.name}`
        );

      directoryPaths.push(`${additionalPath}/${entry.name}`);

      filePaths.push(...childFilePaths);
      directoryPaths.push(...childDirectoryPaths);
    } else {
      filePaths.push(`${additionalPath}/${entry.name}`);
    }
  }

  return { filePaths, directoryPaths };
}

const preCode_JS = `
function ___CreateElement___(tag, props, ...children) {
  const element = document.createElement(tag);

  if (props) {
    Object.keys(props).forEach((key) => {
      if (key === 'className') {
        // JSX uses className instead of class
        element.className = props[key];
      } else {
        element.setAttribute(key, props[key]);
      }
    });
  }

  children.forEach((child) => {
    if (Array.isArray(child)) {
      child.forEach((c) => {
        if (typeof c === 'string') {
          element.appendChild(document.createTextNode(c));
        } else {
          element.appendChild(c);
        }
      });
    } else if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
}

`;

const transformFile_HTML = async (inputPath, outputPath) => {
  const code = await fs.readFile(inputPath, 'utf-8');

  const minifiedCode = HtmlMinifier.minify(Buffer.from(code), {
    keep_spaces_between_attributes: true,
    keep_comments: true,
  });

  await fs.writeFile(outputPath, minifiedCode);
};

const transformFile_JS = async (inputPath, outputPath) => {
  const code = await fs.readFile(inputPath, 'utf-8');

  const result = await babel.transformAsync(preCode_JS + code, babelOptions);
  const transformedCode = result.code;

  await fs.writeFile(outputPath, transformedCode);
};

const transformFile_CSS = async (inputPath, outputPath) => {
  const code = await fs.readFile(inputPath, 'utf-8');

  const result = await postcssInstance.process(code, {
    from: inputPath,
  });
  const transformedCode = result.css;

  const minifyResult = minify_CSS({
    code: Buffer.from(transformedCode),
    minify: true,
  });
  const minifiedCode = minifyResult.code.toString();

  await fs.writeFile(outputPath, minifiedCode);
};

const buildProject = async (sourcePath, outputPath) => {
  const { filePaths, directoryPaths } =
    await listFilesAndDirectoriesRecursively(sourcePath);

  if (!fs_existsSync(outputPath)) await fs.mkdir(outputPath);

  for (const directoryPath of directoryPaths) {
    const dirPath = `${outputPath}/${directoryPath}`;

    if (!fs_existsSync(dirPath)) await fs.mkdir(dirPath);
  }

  for (const filePath of filePaths) {
    const inputPath = `${sourcePath}/${filePath}`;
    const outputPath = `./dist/${filePath}`;

    console.log(inputPath, outputPath);

    if (filePath.endsWith('.html')) {
      await transformFile_HTML(inputPath, outputPath);
    } else if (filePath.endsWith('.js')) {
      await transformFile_JS(inputPath, outputPath);
    } else if (filePath.endsWith('.css')) {
      await transformFile_CSS(inputPath, outputPath);
    } else {
      await fs.copyFile(inputPath, outputPath);
    }
  }
};

(async () => {
  await buildProject('./src', './dist');
})();
