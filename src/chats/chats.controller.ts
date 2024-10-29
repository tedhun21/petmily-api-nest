import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { FindChatRoomInput } from './dto/find-chatRoom.dto';
import { ChatsService } from './chats.service';
import { CreateChatRoomInput } from './dto/create-chatRoom.dto';
import { FindMessageInput } from './dto/find-message.dto';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}
  @Get()
  @UseGuards(JwtAuthGuard)
  findChatRoom(
    @AuthUser() jwtUser: JwtUser,
    @Query() findChatRoomInput: FindChatRoomInput,
  ) {
    return this.chatsService.findChatRoomByUsers(
      jwtUser,
      findChatRoomInput.opponentId,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createChatRoom(
    @AuthUser() jwtUser: JwtUser,
    @Body() createChatRoomInput: CreateChatRoomInput,
  ) {
    return this.chatsService.createChatRoom(jwtUser, createChatRoomInput);
  }

  @Get(':chatRoomId/messages')
  @UseGuards(JwtAuthGuard)
  findMessages(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { chatRoomId: string },
    @Query() findMessageInput: FindMessageInput,
  ) {
    return this.chatsService.findMessages(jwtUser, params, findMessageInput);
  }
}
