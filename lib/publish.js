const path = require('path');
const execa = require('execa');
const AggregateError = require('aggregate-error');
const getRegistry = require('./get-registry');
const getChannel = require('./get-channel');
const getReleaseInfo = require('./get-release-info');

module.exports = async (npmrc, {npmPublish, pkgRoot, publishBranch: publishBranchConfig }, pkg, context) => {
  const {
    cwd,
    env,
    stdout,
    stderr,
    nextRelease: {version, channel},
    logger,
  } = context;

  if (npmPublish !== false && pkg.private !== true) {
    const basePath = pkgRoot ? path.resolve(cwd, pkgRoot) : cwd;
    const registry = getRegistry(pkg, context);
    const distTag = getChannel(channel);

    const currentBranch = execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    const publishBranches = typeof publishBranchConfig === 'string' && publishBranchConfig.split('|');
    const isPublishBranch = publishBranches.includes(currentBranch);
    const publishBranch = isPublishBranch ? currentBranch : 'main';

    logger.log(`Publishing version ${version} on branch ${publishBranch} to npm registry on dist-tag ${distTag}`);

    const result = execa('pnpm', ['publish', basePath, '--publish-branch', publishBranch, '--tag', distTag, '--registry', registry], {
      cwd,
      env,
      preferLocal: true,
    });

    result.stdout.pipe(stdout, {end: false});
    result.stderr.pipe(stderr, {end: false});
    try {
      await result;
    } catch (error) {
      logger.log(
        `Failed to publish ${pkg.name}@${version} to dist-tag @${distTag} on ${registry}: ${error.message || error}`
      );
      throw new AggregateError(error);
    }

    logger.log(`Published ${pkg.name}@${version} to dist-tag @${distTag} on ${registry}`);

    return getReleaseInfo(pkg, context, distTag, registry);
  }

  logger.log(
    `Skip publishing to npm registry as ${npmPublish === false ? 'npmPublish' : "package.json's private property"} is ${
      npmPublish !== false
    }`
  );

  return false;
};
