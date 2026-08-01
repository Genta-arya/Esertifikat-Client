import axios from "axios";



export const UploadImage = async (file) => {
  console.log(file);
  try {
    const response = await axios.post(
      "https://bucket.mgentaarya.my.id/uploads.php",
      { file: file },
      {
        headers: {
          "Content-Type": "multipart/form-data",
          genta: "Genta@456",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};