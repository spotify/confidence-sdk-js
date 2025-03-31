import { Content } from '@/components/Content';

export default function Page1() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Page 1</h1>
      <p className="text-gray-600 mb-8">
        This is page 1. The button style from the home page should persist here.
      </p>
      {/* <Content /> */}
    </div>
  );
} 