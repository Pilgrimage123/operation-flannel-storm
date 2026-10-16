import { createFileRoute } from "@tanstack/react-router";
import { GameApp } from "@/components/flannel/GameApp";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <GameApp />;
}
