import { MantineColorScheme } from '@mantine/core';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Algorithm } from './models.ts';

export interface State {
  colorScheme: MantineColorScheme;

  idToken: string;
  round: string;

  algorithm: Algorithm | null;
  selectedTimestamp: number | null;

  setColorScheme: (colorScheme: MantineColorScheme) => void;
  setIdToken: (idToken: string) => void;
  setRound: (round: string) => void;
  setAlgorithm: (algorithm: Algorithm | null) => void;
  setSelectedTimestamp: (selectedTimestamp: number | null) => void;
}

export const useStore = create<State>()(
  persist(
    set => ({
      colorScheme: 'auto',

      idToken: '',
      round: 'ROUND0',

      algorithm: null,
      selectedTimestamp: null,

      setColorScheme: colorScheme => set({ colorScheme }),
      setIdToken: idToken => set({ idToken }),
      setRound: round => set({ round }),
      setAlgorithm: algorithm => set({ algorithm }),
      setSelectedTimestamp: selectedTimestamp => set({ selectedTimestamp }),
    }),
    {
      name: 'visualizer-prosperity-4',
      partialize: state => ({
        colorScheme: state.colorScheme,
        idToken: state.idToken,
        round: state.round,
      }),
    },
  ),
);
