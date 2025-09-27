import esbuild from 'esbuild';
import { promises as fs } from 'fs';

const watch = process.argv.includes('--watch');

async function build() {
  // Ensure dist exists
  try {
    await fs.mkdir('dist');
  } catch (e) {}

  const common = {
    bundle: true,
    sourcemap: true,
    minify: false,
    platform: 'browser',
    target: ['chrome58', 'firefox57'],
    outdir: 'dist',
    loader: { '.ts': 'ts' }
  };

  const ctx = await esbuild.context({
    entryPoints: {
      'background': './background.ts',
      'content': './content.ts'
    },
    ...common
  });

  if (watch) {
    console.log('esbuild: watching...');
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('esbuild: build complete');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
