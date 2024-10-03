import { Image, StyleSheet, Button } from 'react-native';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { Confidence } from '@spotify-confidence/sdk';
import { ConfidenceProvider, useEvaluateFlag } from '@spotify-confidence/react';
import { Suspense } from 'react';
import { ThemedText } from '@/components/ThemedText';

const getClientSecret = () => {
  const clientSecret = process.env.EXPO_PUBLIC_CLIENT_SECRET;
  if (!clientSecret) throw new Error('Missing client secret');
  return clientSecret;
};

const confidence = Confidence.create({
  clientSecret: getClientSecret(),
  environment: 'client',
  timeout: 3000,
  logger: console,
  fetchImplementation: (req: Request) => {
    console.log('request', req.url);
    return fetch(req);
  },
});

confidence.setContext({ visitor_id: 'a' });
export default function HomeScreen() {
  return (
    // @ts-ignore
    <ConfidenceProvider confidence={confidence}>
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
        headerImage={<Image source={require('@/assets/images/partial-react-logo.png')} style={styles.reactLogo} />}
      >
        <Suspense fallback={<ThemedText>App loading...</ThemedText>}>
          <ThemedText>React Native Example</ThemedText>
          <FlagView />
          <Button
            title="Random context"
            onPress={() => confidence.setContext({ visitor_id: Math.random().toString() })}
          />
        </Suspense>
      </ParallaxScrollView>
    </ConfidenceProvider>
  );
}

function FlagView() {
  const flagData = JSON.stringify(useEvaluateFlag('tutorial-feature.title', 'default'), null, '  ');
  return <ThemedText>{flagData}</ThemedText>;
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
