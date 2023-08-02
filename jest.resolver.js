const internalPkg = /^@spotify-confidence\/([^\/]+)$/;
module.exports = (request, options) => {
  const match = request.match(internalPkg);
  if (match) {
    return `${__dirname}/packages/${match[1]}/src/index.ts`;
  }

  return options.defaultResolver(request, options);
};
