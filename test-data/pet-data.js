export const generatePetData = () => {
  const timestamp = Date.now();
  return {
    id: timestamp,
    name: `Fluffy${timestamp}`,
    category: {
      id: 1,
      name: "Dogs"
    },
    photoUrls: ["https://images.dog.ceo/breeds/deerhound-scottish/n02092002_2851.jpg"],
    tags: [
      {
        id: 1,
        name: "friendly"
      }
    ],
    status: "available"
  };
};

export const petData = {
  dog: {
    id: 12345,
    name: "Buddy",
    category: {
      id: 1,
      name: "Dogs"
    },
    photoUrls: ["https://images.dog.ceo/breeds/hound-afghan/n02088094_1003.jpg"],
    tags: [{ id: 1, name: "friendly" }],
    status: "available"
  }
};