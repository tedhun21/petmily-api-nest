import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { initializeApp } from 'firebase/app';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';

@Injectable()
export class UploadsService {
  private readonly storage: any;

  constructor() {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    };

    // Firebase 앱과 Storage 초기화
    const app = initializeApp(firebaseConfig);
    this.storage = getStorage(app);
  }
  async uploadFile(file: Express.Multer.File) {
    const filename = new Date().getTime() + '-' + file.originalname;
    const storageRef = ref(this.storage, 'images/' + filename);

    try {
      // 파일 업로드
      const snapshot = await uploadBytes(storageRef, file.buffer);

      // 다운로드 URL 가져오기
      const downloadURL = await getDownloadURL(snapshot.ref);

      return downloadURL;
    } catch (e) {
      throw new InternalServerErrorException('Fail to upload file.');
    }
  }

  async deleteFile(fileUrl: { url: string }) {
    const { url } = fileUrl;

    const storage = getStorage();

    const imageRef = ref(storage, url);

    try {
      await deleteObject(imageRef);
      return true;
    } catch (e) {
      throw new InternalServerErrorException('Fail to delete file.');
    }
  }
}
