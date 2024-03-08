module.exports = ({ env }) => ({
  rest: {
    defaultLimit: 200,
    maxLimit: 200,
    withCount: true,
  },
  uploadToken: env('UPLOAD_TOKEN')
});
