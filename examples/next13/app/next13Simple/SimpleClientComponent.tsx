'use client';

interface ClientComponentProps {
  string: string;
}
export function SimpleClientComponent(props: ClientComponentProps) {
  return <p>Using the property in the client: {props.string}</p>;
}
