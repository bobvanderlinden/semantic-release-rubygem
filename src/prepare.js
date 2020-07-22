const { readFile, writeFile } = require('fs').promises;
const path = require('path');
const execa = require('execa');
const { VERSION_REGEX } = require('./common');

const writeVersion = async ({ versionFile, nextVersion, logger, cwd }) => {
  const fullVersionPath = path.resolve(cwd, versionFile);
  const versionContents = await readFile(fullVersionPath, 'utf8');
  const newContents = versionContents.replace(
    VERSION_REGEX,
    // Rubygems replaces all `-` with `.pre.`, which causes odd version differences between tags/releases
    // and the published gem version. Replacing `-` with `.` is a smaller difference.
    `$1${nextVersion.replace('-', '.')}$2`,
  );
  logger.log('Writing version %s to `%s`', nextVersion, versionFile);
  await writeFile(fullVersionPath, newContents, 'utf8');
};

const bundleInstall = async ({ updateGemfileLock, cwd, env, logger, stdout, stderr }) => {
  const command = typeof updateGemfileLock === 'string' ? updateGemfileLock : 'bundle install';
  logger.log('Updating lock file with command `%s`', command);
  const installResult = execa.command(command, { cwd, env });
  installResult.stdout.pipe(stdout, { end: false });
  installResult.stderr.pipe(stderr, { end: false });

  await installResult;
};

const buildGem = async ({ gemspec, gemName, version, cwd, env, logger, stdout, stderr }) => {
  const gemFile = `${gemName}-${version}.gem`;
  // TODO: Parse the gem file name from the output?
  logger.log('Building gem `%s`', gemFile);
  const buildResult = execa('gem', ['build', gemspec], { cwd, env });
  buildResult.stdout.pipe(stdout, { end: false });
  buildResult.stderr.pipe(stderr, { end: false });
  await buildResult;

  return gemFile;
};

module.exports = async function prepare(
  { updateGemfileLock = false },
  { nextRelease: { version }, cwd, env, logger, stdout, stderr },
  { versionFile, gemspec, gemName },
) {
  await writeVersion({ versionFile, nextVersion: version, logger, cwd });

  if (updateGemfileLock) {
    await bundleInstall({ updateGemfileLock, cwd, env, logger, stdout, stderr });
  }

  const gemFile = await buildGem({ gemspec, gemName, version, cwd, env, logger, stdout, stderr });

  return { gemFile };
};
