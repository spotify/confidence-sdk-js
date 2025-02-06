'use server';

export async function fetchData(): Promise<string> {
  return fetch('https://fake-json-api.mock.beeceptor.com/companies').then(async result => {
    // await new Promise(resolve => {
    //     setTimeout(resolve, 5000);
    // });
    if (result.ok) {
      return (await result.json())[2].name;
    }
    return 'no';
  });
}
