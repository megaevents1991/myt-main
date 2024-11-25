export const parseDuration = (duration: string) => {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?/;
  const matches = duration.match(regex);

  if (!matches) {
    return 0;
  }

  try {
    const hours = +matches[1];
    const minutes = +matches[2];
    return hours * 60 + minutes; // Total minutes
  } catch (error) {
    console.log(`Error parsing duration : ${error}`, duration);
    return 0;
  }
};
