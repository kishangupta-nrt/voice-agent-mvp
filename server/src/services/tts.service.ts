import axios from 'axios';
import { ENV } from '../config/env';

const PIPER_URL = process.env.PIPER_URL || 'http://localhost:5000';

interface TtsRequest {
  text: string;
  voice?: string;
}

export class TtsService {
  private usePiper = false;
  private checkPiperPromise: Promise<boolean> | null = null;

  async checkPiperAvailable(): Promise<boolean> {
    if (this.checkPiperPromise) {
      return this.checkPiperPromise;
    }

    this.checkPiperPromise = (async () => {
      try {
        await axios.get(`${PIPER_URL}/health`, { timeout: 2000 });
        this.usePiper = true;
        return true;
      } catch {
        this.usePiper = false;
        return false;
      }
    })();

    return this.checkPiperPromise;
  }

  async synthesize(text: string): Promise<{ audio: string; wasPiper: boolean }> {
    const isPiper = await this.checkPiperAvailable();

    if (isPiper) {
      try {
        const response = await axios.post(
          `${PIPER_URL}/synthesize`,
          { text },
          { timeout: 10000 }
        );
        return {
          audio: response.data.audio,
          wasPiper: true,
        };
      } catch (error) {
        console.error('Piper synthesis error:', error);
      }
    }

    return {
      audio: '',
      wasPiper: false,
    };
  }

  isUsingPiper(): boolean {
    return this.usePiper;
  }
}

export const ttsService = new TtsService();