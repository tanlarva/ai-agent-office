import { animeCast } from './anime-cast';

export function AnimeCastCredits() {
  return <details className="cast-credits">
    <summary>Nhân vật & tác giả</summary>
    <p><a href={animeCast[0]!.source} target="_blank" rel="noreferrer">Yori</a> · 躑躅屋 / 有島リツ<br /><a href={animeCast[1]!.source} target="_blank" rel="noreferrer">Amane</a> · yousoron-shop</p>
  </details>;
}
