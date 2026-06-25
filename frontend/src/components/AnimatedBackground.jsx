export default function AnimatedBackground() {
  return (
    <ul className="bg-particles">
      {Array.from({ length: 41 }, (_, i) => (
        <li key={i} />
      ))}
    </ul>
  );
}
